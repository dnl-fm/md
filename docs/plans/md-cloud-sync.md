# MD Cloud Sync

**Status**: Planning  
**Created**: 2025-12-16  
**Branch**: `feat/cloud-sync`  
**Server**: `94.130.18.211` (api.getmd.dev)

## Overview

Sync markdown documents between browser extension and desktop app via cloud storage. Users can access their documents from anywhere, edit them, and changes sync automatically.

---

## Core Concept

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  MD Extension   │────────▶│   MD Cloud API  │◀────────│     MD App      │
│   (Browser)     │         │  (api.getmd.dev)│         │   (Desktop)     │
└─────────────────┘         └────────┬────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  SQLite (per    │
                            │     user)       │
                            └─────────────────┘
```

**User Flow:**
1. User views markdown in extension → "Save to Cloud" button
2. Document saved to user's cloud storage
3. User opens MD App → Cloud icon in sidebar
4. Opens cloud modal → sees all synced documents
5. Opens document → edits → saves → synced back to cloud
6. Extension shows updated document

---

## Development Mode

**No auth required during development:**
- Hardcoded user ID: `dev-user-001`
- No signup/signin flow
- Direct API access
- Single SQLite database for testing

**Toggle via environment:**
```
MD_DEV_MODE=true
MD_DEV_USER_ID=dev-user-001
```

---

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| API Server | Go + Chi | Existing api.getmd.dev infrastructure |
| Database | SQLite (per user) | Simple, portable, easy backup |
| Storage | Local filesystem | `data/users/{user_id}/documents.db` |
| Auth (later) | JWT + getmd.dev | Phase 2 |

---

## Data Model

### Document Schema

```sql
CREATE TABLE documents (
    id TEXT PRIMARY KEY,              -- UUID
    title TEXT NOT NULL,              -- Document title (from first H1 or filename)
    content TEXT NOT NULL,            -- Full markdown content
    source_url TEXT,                  -- Original URL (if from extension)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    content_hash TEXT NOT NULL,       -- SHA256 of content (for change detection)
    size_bytes INTEGER NOT NULL,      -- Content size
    word_count INTEGER DEFAULT 0,     -- Approximate word count
    is_deleted INTEGER DEFAULT 0,     -- Soft delete flag
    deleted_at DATETIME               -- When deleted
);

CREATE INDEX idx_documents_updated_at ON documents(updated_at);
CREATE INDEX idx_documents_accessed_at ON documents(accessed_at);
CREATE INDEX idx_documents_is_deleted ON documents(is_deleted);
```

### Sync Metadata (Client-side)

```typescript
interface SyncState {
  lastSyncAt: string;           // ISO timestamp of last successful sync
  pendingChanges: string[];     // Document IDs with local changes
  syncInProgress: boolean;
}
```

---

## API Endpoints

Base URL: `https://api.getmd.dev/v1/cloud`

### List Documents

```
GET /documents
Authorization: Bearer {token}  (or X-Dev-User: dev-user-001 in dev mode)

Query params:
  - since: ISO timestamp (only docs updated after this time)
  - include_deleted: boolean (include soft-deleted docs)

Response: 200 OK
{
  "documents": [
    {
      "id": "uuid",
      "title": "Document Title",
      "source_url": "https://...",
      "created_at": "2025-12-16T12:00:00Z",
      "updated_at": "2025-12-16T12:30:00Z",
      "accessed_at": "2025-12-16T12:30:00Z",
      "content_hash": "sha256...",
      "size_bytes": 1234,
      "word_count": 256,
      "is_deleted": false
    }
  ],
  "sync_token": "timestamp-or-cursor"
}
```

### Get Document

```
GET /documents/{id}
Authorization: Bearer {token}

Response: 200 OK
{
  "id": "uuid",
  "title": "Document Title",
  "content": "# Full markdown content...",
  "source_url": "https://...",
  "created_at": "2025-12-16T12:00:00Z",
  "updated_at": "2025-12-16T12:30:00Z",
  "content_hash": "sha256...",
  "size_bytes": 1234,
  "word_count": 256
}
```

### Create Document

```
POST /documents
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Document Title",
  "content": "# Markdown content...",
  "source_url": "https://..." (optional)
}

Response: 201 Created
{
  "id": "new-uuid",
  "title": "Document Title",
  "created_at": "2025-12-16T12:00:00Z",
  "updated_at": "2025-12-16T12:00:00Z",
  "content_hash": "sha256..."
}
```

### Update Document

```
PUT /documents/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Updated Title",      (optional)
  "content": "# Updated...",     (optional)
  "base_hash": "sha256..."       (for conflict detection)
}

Response: 200 OK
{
  "id": "uuid",
  "updated_at": "2025-12-16T12:30:00Z",
  "content_hash": "new-sha256..."
}

Response: 409 Conflict (if base_hash doesn't match)
{
  "error": "conflict",
  "server_hash": "sha256...",
  "server_updated_at": "2025-12-16T12:25:00Z"
}
```

### Delete Document (Soft)

```
DELETE /documents/{id}
Authorization: Bearer {token}

Response: 204 No Content
```

### Batch Sync (Optimization)

```
POST /documents/sync
Authorization: Bearer {token}
Content-Type: application/json

{
  "since": "2025-12-16T12:00:00Z",
  "changes": [
    { "id": "uuid", "content_hash": "local-hash", "updated_at": "..." }
  ]
}

Response: 200 OK
{
  "updated": [...],      // Docs updated on server (need to pull)
  "conflicts": [...],    // Docs with conflicts
  "deleted": [...],      // IDs of deleted docs
  "sync_token": "..."
}
```

---

## UI Design

### Sidebar Cloud Icon

**Location:** Bottom of sidebar, above settings

```
┌─────────────────────┐
│ 📁 Recent Files     │
│   document1.md      │
│   document2.md      │
│                     │
│ 📝 Drafts           │
│   Untitled          │
│                     │
│─────────────────────│
│ ☁️  Cloud (3)       │  ← New: Cloud icon with doc count
│ ⚙️  Settings        │
└─────────────────────┘
```

**States:**
- `☁️` - Normal (synced)
- `☁️↻` - Syncing in progress
- `☁️!` - Sync error / offline
- `☁️(3)` - Badge with document count

### Cloud Modal

```
┌──────────────────────────────────────────────────────────┐
│  ☁️ Cloud Documents                              ✕ Close │
├──────────────────────────────────────────────────────────┤
│  🔍 Search documents...                                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  📄 Getting Started with MD                              │
│     Updated 2 hours ago · 1.2 KB                         │
│                                                          │
│  📄 200k Tokens Is Plenty                                │
│     from ampcode.com · Updated yesterday · 3.4 KB        │
│                                                          │
│  📄 Project Notes                                        │
│     Updated 3 days ago · 856 B                           │
│                                                          │
│  📄 API Documentation                                    │
│     from github.com · Updated last week · 12 KB          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Synced just now · 4 documents · 17.5 KB total           │
└──────────────────────────────────────────────────────────┘
```

**Document Row Actions (on hover):**
- Click → Open document
- `⋮` menu → Delete, View source URL

### Extension: Save to Cloud

**Location:** Header, replaces potential "Open in App" button

```
┌─────────────────────────────────────────────────────────────┐
│ 📄 README.md                    [☁️ Save] [Print] [Exit]   │
└─────────────────────────────────────────────────────────────┘
```

**States:**
- `☁️ Save` - Not yet saved to cloud
- `☁️ Saved` - Already in cloud (with checkmark)
- `☁️ Saving...` - In progress

---

## Sync Strategy

### When to Sync

| Event | Action |
|-------|--------|
| App launch | Fetch document list (metadata only) |
| Cloud modal open | Refresh document list |
| Document opened from cloud | Fetch full content |
| Document saved | Push to cloud immediately |
| Extension "Save to Cloud" | Create/update document |
| Every 5 minutes (background) | Check for updates (if app open) |

### Conflict Resolution

**Strategy: Last-write-wins with notification**

1. Client sends `base_hash` with update
2. Server compares with current hash
3. If mismatch → 409 Conflict response
4. Client shows notification: "Document was modified elsewhere. Reload or overwrite?"
5. User chooses:
   - **Reload**: Fetch server version, lose local changes
   - **Overwrite**: Force push local version

**Future enhancement:** Three-way merge for text content

### Offline Behavior

- **Extension:** "Save to Cloud" disabled when offline, show tooltip
- **App:** 
  - Cloud documents cached locally in `~/.md/cloud-cache/`
  - Edits saved to cache with "pending sync" flag
  - Sync when back online
  - Visual indicator: `☁️!` icon

---

## Implementation Phases

### Phase 1: API + Basic Sync (MVP)

**API (Go):**
- [ ] Create `/v1/cloud` route group
- [ ] Implement SQLite per-user storage
- [ ] `GET /documents` - list documents (metadata)
- [ ] `GET /documents/{id}` - get full document
- [ ] `POST /documents` - create document
- [ ] `PUT /documents/{id}` - update document
- [ ] `DELETE /documents/{id}` - soft delete
- [ ] Dev mode: hardcoded user, no auth

**App (Desktop):**
- [ ] Cloud icon in sidebar
- [ ] Cloud modal with document list
- [ ] Open document from cloud
- [ ] Save document to cloud
- [ ] Basic sync on app launch

**Extension:**
- [ ] "Save to Cloud" button in header
- [ ] API client for cloud endpoints
- [ ] Success/error feedback

### Phase 2: Polish + UX

- [ ] Search in cloud modal
- [ ] Sync status indicator
- [ ] Conflict resolution UI
- [ ] Offline cache (app)
- [ ] Background sync
- [ ] Delete confirmation

### Phase 3: Authentication

- [ ] getmd.dev signup/signin
- [ ] JWT token management
- [ ] Extension auth flow (OAuth or token input)
- [ ] App auth flow
- [ ] Token refresh

### Phase 4: Advanced Features

- [ ] Document sharing (public links)
- [ ] Revision history
- [ ] Collaborative editing (future)
- [ ] Export/import

---

## File Structure

### API

```
packages/api/
├── cmd/server/
│   └── main.go
├── internal/
│   ├── handlers/
│   │   ├── cloud.go          # NEW: Cloud document handlers
│   │   └── render.go         # Existing mermaid/ascii
│   ├── storage/
│   │   └── sqlite.go         # NEW: Per-user SQLite management
│   └── middleware/
│       └── auth.go           # NEW: Auth middleware (dev mode bypass)
├── data/
│   └── users/
│       └── {user_id}/
│           └── documents.db  # Per-user SQLite
└── Dockerfile
```

### App

```
packages/app/src/
├── components/
│   ├── cloud-modal.tsx       # NEW: Cloud documents modal
│   └── cloud-icon.tsx        # NEW: Sidebar cloud icon
├── stores/
│   └── cloud-store.ts        # NEW: Cloud state management
├── api/
│   └── cloud-client.ts       # NEW: API client for cloud
└── ...
```

### Extension

```
packages/extension/src/
├── cloud-api.ts              # NEW: API client
├── content.ts                # Add "Save to Cloud" button
└── ...
```

---

## Configuration

### API Server

```env
# .env
MD_DEV_MODE=true
MD_DEV_USER_ID=dev-user-001
MD_DATA_DIR=/data/users
MD_MAX_DOCUMENT_SIZE=1048576   # 1MB limit
```

### App

```json
// ~/.md/config.json (extended)
{
  "cloud": {
    "enabled": true,
    "apiUrl": "https://api.getmd.dev/v1/cloud",
    "syncInterval": 300,        // seconds
    "offlineCache": true
  }
}
```

### Extension

```typescript
// Stored in chrome.storage.local
{
  "cloudApiUrl": "https://api.getmd.dev/v1/cloud",
  "cloudEnabled": true
}
```

---

## Security Considerations

1. **Per-user SQLite:** Each user's data completely isolated
2. **Content size limit:** 1MB per document (prevent abuse)
3. **Rate limiting:** 100 requests/minute per user
4. **HTTPS only:** All API traffic encrypted
5. **Soft delete:** Documents recoverable for 30 days
6. **No server-side rendering:** Content stored as-is, rendered client-side

---

## SQLite Per-User: Pros & Cons

### Pros
- **Isolation:** Complete data separation between users
- **Portability:** Easy to backup/restore individual users
- **Performance:** No table locking between users
- **Simplicity:** No complex multi-tenant queries
- **GDPR:** Easy data export/deletion per user

### Cons
- **Connection management:** Many small databases
- **Cross-user queries:** Impossible (but we don't need them)
- **Disk usage:** Some overhead per database file

### Mitigation
- Use connection pooling per user (limited lifetime)
- Lazy-load databases (only when user active)
- Archive inactive users' databases to cold storage

---

## Quick Start (Development)

```bash
# 1. Start API server with dev mode
cd packages/api
MD_DEV_MODE=true MD_DEV_USER_ID=dev-user-001 go run cmd/server/main.go

# 2. Start app in dev mode
cd packages/app
make dev

# 3. Build extension
cd packages/extension
bun run build
# Load in Chrome

# 4. Test flow:
#    - Open markdown in browser → Click "Save to Cloud"
#    - Open app → Click cloud icon → See saved document
#    - Edit in app → Save → Check API logs
```

---

## Open Questions (Answered)

**Q: Why SQLite per user instead of single database?**  
A: Isolation, portability, simpler backup/GDPR compliance. The overhead is minimal for our use case.

**Q: How to handle very large documents?**  
A: 1MB limit per document. For larger files, suggest splitting or using external hosting.

**Q: What about images in markdown?**  
A: Store markdown only. Images remain as URLs (relative or absolute). Future: image proxy/hosting.

**Q: How to handle concurrent edits (same user, multiple devices)?**  
A: Last-write-wins with conflict detection. Show warning, let user choose.

**Q: What happens when user deletes account?**  
A: Delete entire SQLite file. Clean and simple.

**Q: How to migrate from dev mode to production?**  
A: Dev user's database can be assigned to their real account after signup.

---

## Success Metrics

- [ ] Save document from extension → appears in app within 5 seconds
- [ ] Edit in app → save → refresh extension → see changes
- [ ] 100 documents sync without performance issues
- [ ] Works offline (app) with sync on reconnect
- [ ] < 200ms API response time for document list
