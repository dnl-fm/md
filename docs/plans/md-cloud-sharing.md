# MD Cloud Sharing

**Status**: Planning  
**Created**: 2025-12-16  
**Branch**: `feat/cloud-sharing`  
**Server**: `94.130.18.211` (api.getmd.dev)  
**Depends on**: [MD Cloud Sync](./md-cloud-sync.md) (Phase 1-2)

## Overview

Share markdown documents with colleagues. Multiple users can view and edit shared documents with automatic conflict resolution using three-way merge.

---

## User Stories

1. **As a document owner**, I want to share a document with a colleague so we can collaborate
2. **As a collaborator**, I want to see documents shared with me in a dedicated section
3. **As an editor**, I want my changes merged automatically when possible
4. **As an editor**, I want to resolve conflicts when automatic merge fails
5. **As a collaborator**, I want to be notified when a shared document changes
6. **As an owner**, I want to revoke access to shared documents
7. **As a user**, I want to see who else has access to a document

---

## Core Concepts

### Ownership Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOCUMENT                                 │
├─────────────────────────────────────────────────────────────────┤
│  Owner: user_123                                                │
│  ├── Full control (edit, delete, share, unshare)               │
│  └── Canonical version lives in owner's database               │
│                                                                 │
│  Collaborators:                                                 │
│  ├── user_456 (write) - Can view and edit                      │
│  ├── user_789 (write) - Can view and edit                      │
│  └── user_abc (read)  - Can only view                          │
└─────────────────────────────────────────────────────────────────┘
```

**Key principle**: Document lives in owner's SQLite database. Collaborators get a reference, not a copy.

### Document States

```
┌──────────────┐     share      ┌──────────────┐
│    PRIVATE   │ ─────────────▶ │    SHARED    │
│  (default)   │                │              │
└──────────────┘                └──────────────┘
                                      │
                    unshare all       │
                ◀─────────────────────┘
```

### Collaborator States

```
                    ┌─────────────┐
          invite    │   PENDING   │  (future: email invites)
        ┌──────────▶│             │
        │           └──────┬──────┘
        │                  │ accept
        │                  ▼
┌───────┴───────┐   ┌─────────────┐
│  NOT SHARED   │   │   ACTIVE    │
│               │   │             │
└───────────────┘   └──────┬──────┘
        ▲                  │ owner revokes
        │                  │ or user leaves
        └──────────────────┘
```

---

## Data Model

### Schema Additions

```sql
-- Add to owner's database
-- Tracks who document is shared with
CREATE TABLE shares (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    shared_with_email TEXT NOT NULL,      -- Email of collaborator
    shared_with_id TEXT,                   -- User ID (null until they accept/login)
    permission TEXT NOT NULL DEFAULT 'write',  -- 'read' or 'write'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,                  -- When collaborator first accessed
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE(document_id, shared_with_email)
);

CREATE INDEX idx_shares_document ON shares(document_id);
CREATE INDEX idx_shares_user ON shares(shared_with_id);

-- Revision history (for three-way merge)
CREATE TABLE revisions (
    id TEXT PRIMARY KEY,                   -- UUID
    document_id TEXT NOT NULL,
    revision_num INTEGER NOT NULL,         -- Sequential: 1, 2, 3...
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,              -- User ID who made this revision
    parent_revision_id TEXT,               -- Previous revision (for merge tracking)
    merge_base_id TEXT,                    -- If this was a merge, what was the base
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE(document_id, revision_num)
);

CREATE INDEX idx_revisions_document ON revisions(document_id, revision_num);

-- Global database (api server) - maps shares across users
CREATE TABLE shared_documents_index (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    document_id TEXT NOT NULL,             -- ID in owner's database
    shared_with_id TEXT NOT NULL,
    permission TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_id, document_id, shared_with_id)
);

CREATE INDEX idx_shared_docs_user ON shared_documents_index(shared_with_id);
```

### Document with Sharing Info

```typescript
interface Document {
  id: string;
  title: string;
  content: string;
  content_hash: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  
  // Sharing info (populated when fetching)
  is_shared: boolean;
  shared_with: Collaborator[];
  current_revision: number;
  
  // For collaborators viewing shared docs
  is_owned: boolean;           // true if current user is owner
  owner_name?: string;         // Owner's display name if not owned
  my_permission?: 'read' | 'write';
}

interface Collaborator {
  email: string;
  user_id?: string;
  permission: 'read' | 'write';
  accepted_at?: string;
}

interface Revision {
  id: string;
  revision_num: number;
  content: string;
  content_hash: string;
  created_at: string;
  created_by: string;
  created_by_name: string;
}
```

---

## Three-Way Merge Implementation

### How It Works

```
                    BASE (v3)
                    Common ancestor
                    "Last version both saw"
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
        YOURS (v4)              THEIRS (v4')
        Your save               Their save
        (on server)             (incoming)
            │                       │
            │     diff-match-patch  │
            ▼                       ▼
        ┌───────┐               ┌───────┐
        │Patch A│               │Patch B│
        └───┬───┘               └───┬───┘
            │                       │
            └───────────┬───────────┘
                        ▼
                  Apply both to BASE
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
    ┌─────────────┐         ┌─────────────┐
    │ AUTO-MERGED │         │  CONFLICT   │
    │   (v5)      │         │  (manual)   │
    └─────────────┘         └─────────────┘
```

### Finding the Merge Base

**Question**: How do we know which revision is the common ancestor?

**Answer**: Track `base_revision` when saving.

```typescript
// When collaborator saves, they send:
{
  document_id: "doc-123",
  content: "# Updated content...",
  base_revision: 3,        // "I edited from revision 3"
  base_hash: "abc123..."   // Hash of revision 3 (verification)
}

// Server checks:
// - Current revision is 4 (someone else saved)
// - Collaborator's base is 3
// - Need to merge: revision 3 (base) + revision 4 (current) + incoming
```

### Merge Algorithm

```typescript
import DiffMatchPatch from 'diff-match-patch';

interface MergeResult {
  success: boolean;
  merged_content: string | null;
  conflicts: ConflictRegion[];
  auto_resolved: number;      // Count of auto-resolved changes
}

interface ConflictRegion {
  line_start: number;
  line_end: number;
  base_text: string;
  yours_text: string;
  theirs_text: string;
}

function threeWayMerge(
  base: string, 
  yours: string, 
  theirs: string
): MergeResult {
  const dmp = new DiffMatchPatch();
  
  // If either is identical to base, easy merge
  if (yours === base) {
    return { success: true, merged_content: theirs, conflicts: [], auto_resolved: 0 };
  }
  if (theirs === base) {
    return { success: true, merged_content: yours, conflicts: [], auto_resolved: 0 };
  }
  if (yours === theirs) {
    return { success: true, merged_content: yours, conflicts: [], auto_resolved: 0 };
  }
  
  // Create patches: base → yours
  const patches = dmp.patch_make(base, yours);
  
  // Apply patches to theirs
  const [merged, results] = dmp.patch_apply(patches, theirs);
  
  // Check results
  const failedPatches = results.filter((r, i) => !r).length;
  
  if (failedPatches === 0) {
    // All patches applied cleanly
    return { 
      success: true, 
      merged_content: merged, 
      conflicts: [],
      auto_resolved: patches.length
    };
  }
  
  // Some patches failed - detect conflict regions
  const conflicts = detectConflicts(base, yours, theirs);
  
  return {
    success: false,
    merged_content: null,
    conflicts,
    auto_resolved: results.filter(r => r).length
  };
}

function detectConflicts(base: string, yours: string, theirs: string): ConflictRegion[] {
  const dmp = new DiffMatchPatch();
  const conflicts: ConflictRegion[] = [];
  
  // Line-by-line diff for clearer conflict detection
  const baseLines = base.split('\n');
  const yoursLines = yours.split('\n');
  const theirsLines = theirs.split('\n');
  
  // Use diff to find changed regions
  const yoursDiff = dmp.diff_main(base, yours);
  const theirsDiff = dmp.diff_main(base, theirs);
  
  dmp.diff_cleanupSemantic(yoursDiff);
  dmp.diff_cleanupSemantic(theirsDiff);
  
  // Find overlapping change regions
  // (Simplified - real implementation would be more sophisticated)
  const yoursChanges = getChangedRegions(yoursDiff);
  const theirsChanges = getChangedRegions(theirsDiff);
  
  for (const yc of yoursChanges) {
    for (const tc of theirsChanges) {
      if (regionsOverlap(yc, tc)) {
        conflicts.push({
          line_start: yc.start,
          line_end: Math.max(yc.end, tc.end),
          base_text: extractLines(baseLines, yc.start, yc.end),
          yours_text: extractLines(yoursLines, yc.start, yc.end),
          theirs_text: extractLines(theirsLines, tc.start, tc.end)
        });
      }
    }
  }
  
  return conflicts;
}
```

### Merge Scenarios

| Scenario | Base | Yours | Theirs | Result |
|----------|------|-------|--------|--------|
| No conflict | "A B C" | "A B C D" | "A X C" | ✅ "A X C D" |
| Same change | "A B C" | "A X C" | "A X C" | ✅ "A X C" |
| Different lines | "A\nB\nC" | "A\nX\nC" | "A\nB\nY" | ✅ "A\nX\nY" |
| Same line, different | "A B C" | "A X C" | "A Y C" | ⚠️ Conflict |
| One deletes, one edits | "A B C" | "A C" | "A X C" | ⚠️ Conflict |
| Both add same place | "A C" | "A B C" | "A X C" | ⚠️ Conflict |

---

## API Endpoints

### Share Management

```
POST /documents/{id}/share
Authorization: Bearer {token}

{
  "email": "alice@example.com",
  "permission": "write"
}

Response: 201 Created
{
  "share_id": "share-uuid",
  "document_id": "doc-123",
  "shared_with_email": "alice@example.com",
  "permission": "write",
  "created_at": "2025-12-16T12:00:00Z"
}
```

```
GET /documents/{id}/shares
Authorization: Bearer {token}

Response: 200 OK
{
  "shares": [
    {
      "share_id": "share-uuid",
      "email": "alice@example.com",
      "user_id": "user-456",
      "permission": "write",
      "accepted_at": "2025-12-16T12:05:00Z"
    }
  ]
}
```

```
DELETE /documents/{id}/share/{share_id}
Authorization: Bearer {token}

Response: 204 No Content
```

### Shared Documents (Collaborator View)

```
GET /shared-with-me
Authorization: Bearer {token}

Response: 200 OK
{
  "documents": [
    {
      "id": "doc-123",
      "title": "Project Notes",
      "owner_id": "user-123",
      "owner_name": "John",
      "owner_email": "john@example.com",
      "my_permission": "write",
      "updated_at": "2025-12-16T12:30:00Z",
      "current_revision": 5
    }
  ]
}
```

### Save with Merge

```
PUT /documents/{id}
Authorization: Bearer {token}

{
  "content": "# Updated content...",
  "base_revision": 3,
  "base_hash": "abc123..."
}

Response: 200 OK (auto-merged)
{
  "id": "doc-123",
  "revision": 5,
  "content_hash": "def456...",
  "merged": true,
  "auto_resolved": 2
}

Response: 409 Conflict (manual merge needed)
{
  "error": "conflict",
  "base_revision": 3,
  "current_revision": 4,
  "conflicts": [
    {
      "line_start": 10,
      "line_end": 12,
      "base_text": "- Original task",
      "yours_text": "- Updated task",
      "theirs_text": "- Their task"
    }
  ],
  "base_content": "...",
  "current_content": "...",
  "your_content": "..."
}
```

### Force Save (After Manual Resolution)

```
PUT /documents/{id}/resolve
Authorization: Bearer {token}

{
  "content": "# Manually resolved content...",
  "base_revision": 4,
  "resolution_type": "manual"  // or "keep_mine", "keep_theirs"
}

Response: 200 OK
{
  "id": "doc-123",
  "revision": 5,
  "content_hash": "xyz789..."
}
```

### Revision History

```
GET /documents/{id}/revisions
Authorization: Bearer {token}

Query params:
  - limit: number (default 20)
  - before: revision number

Response: 200 OK
{
  "revisions": [
    {
      "revision_num": 5,
      "created_at": "2025-12-16T12:30:00Z",
      "created_by": "user-456",
      "created_by_name": "Alice",
      "content_hash": "abc...",
      "is_merge": false
    },
    {
      "revision_num": 4,
      "created_at": "2025-12-16T12:25:00Z",
      "created_by": "user-123",
      "created_by_name": "John",
      "content_hash": "def...",
      "is_merge": true,
      "merge_base_revision": 3
    }
  ]
}
```

```
GET /documents/{id}/revisions/{rev}
Authorization: Bearer {token}

Response: 200 OK
{
  "revision_num": 3,
  "content": "# Full content at this revision...",
  "created_at": "2025-12-16T12:00:00Z",
  "created_by": "user-123",
  "created_by_name": "John"
}
```

### Diff Between Revisions

```
GET /documents/{id}/diff?from=3&to=5
Authorization: Bearer {token}

Response: 200 OK
{
  "from_revision": 3,
  "to_revision": 5,
  "diff": [
    { "type": "equal", "text": "# Project Notes\n\n" },
    { "type": "delete", "text": "- Old task\n" },
    { "type": "insert", "text": "- New task\n- Another task\n" },
    { "type": "equal", "text": "\n## Goals\n..." }
  ],
  "stats": {
    "additions": 2,
    "deletions": 1,
    "changes": 1
  }
}
```

---

## UI Design

### Share Modal (Owner)

```
┌──────────────────────────────────────────────────────────────┐
│  Share "Project Notes"                                   ✕   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────┐  ┌────────────────┐ │
│  │ alice@example.com                  │  │ Share (write) ▼│ │
│  └────────────────────────────────────┘  └────────────────┘ │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  People with access:                                         │
│                                                              │
│  👤 You (owner)                                    Owner     │
│                                                              │
│  👤 alice@example.com                              Write  ✕  │
│     Accepted · Last viewed 2 hours ago                       │
│                                                              │
│  👤 bob@example.com                                Read   ✕  │
│     Pending invite                                           │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  🔗 Copy link    (future: public link sharing)               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Shared With Me Section (Sidebar)

```
┌─────────────────────────────────────┐
│ 📁 My Documents                     │
│   ├── project-notes.md              │
│   └── ideas.md                      │
│                                     │
│ 👥 Shared with me (2)               │  ← New section
│   ├── 📄 Team Roadmap               │
│   │      by Alice · 2h ago          │
│   └── 📄 API Specs                  │
│          by Bob · yesterday         │
│                                     │
│ ☁️ Cloud                            │
│ ⚙️ Settings                         │
└─────────────────────────────────────┘
```

### Conflict Resolution Modal

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Merge Conflict                                                   ✕   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Alice edited "Project Notes" while you were working.                    │
│  1 conflict needs your attention. 3 changes were auto-merged.            │
│                                                                          │
│  ┌─ CONFLICT 1 of 1 ───────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │  Line 10-12: Both edited the Tasks section                          │ │
│  │                                                                     │ │
│  │  ┌─ Your version ──────────────┐ ┌─ Alice's version ──────────────┐│ │
│  │  │ ## Tasks                    │ │ ## Tasks                       ││ │
│  │  │ - Build API ✓               │ │ - Build API                    ││ │
│  │  │ - Write tests               │ │ - Write tests ✓                ││ │
│  │  │ - Deploy to staging         │ │ - Add documentation            ││ │
│  │  └─────────────────────────────┘ └────────────────────────────────┘│ │
│  │                                                                     │ │
│  │  Resolution:                                                        │ │
│  │  ○ Keep your version                                                │ │
│  │  ○ Keep Alice's version                                             │ │
│  │  ● Keep both (yours first)                                          │ │
│  │  ○ Keep both (Alice's first)                                        │ │
│  │  ○ Edit manually                                                    │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Preview of merged result:                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │ ## Tasks                                                             ││
│  │ - Build API ✓                                                        ││
│  │ - Write tests                                                        ││
│  │ - Deploy to staging           ← Your addition                        ││
│  │ - Add documentation           ← Alice's addition                     ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│                                    [ Cancel ]  [ Save Merged Version ]   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Revision History Modal

```
┌──────────────────────────────────────────────────────────────────────────┐
│  📜 Revision History - "Project Notes"                               ✕   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ Revisions ──────────────────────┐  ┌─ Preview ─────────────────────┐│
│  │                                  │  │                               ││
│  │  ● v5 (current)                  │  │  # Project Notes              ││
│  │    Today 12:30 PM · Alice        │  │                               ││
│  │    Auto-merged                   │  │  ## Goals                     ││
│  │                                  │  │  - Launch MVP                 ││
│  │  ○ v4                            │  │  - Get feedback               ││
│  │    Today 12:25 PM · You          │  │  - Reach 100 users            ││
│  │    Added deployment task         │  │                               ││
│  │                                  │  │  ## Tasks                     ││
│  │  ○ v3                            │  │  - Build API ✓                ││
│  │    Today 11:00 AM · You          │  │  - Write tests ✓              ││
│  │                                  │  │  - Deploy to staging          ││
│  │  ○ v2                            │  │  - Add documentation          ││
│  │    Yesterday 4:00 PM · Alice     │  │                               ││
│  │                                  │  │                               ││
│  │  ○ v1                            │  │                               ││
│  │    Dec 14 · You                  │  │                               ││
│  │    Initial version               │  │                               ││
│  │                                  │  │                               ││
│  └──────────────────────────────────┘  └───────────────────────────────┘│
│                                                                          │
│  [ Compare v4 ↔ v5 ]  [ Restore v4 ]                    [ Close ]        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Diff View Modal

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Comparing v4 → v5                                                   ✕   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  +2 additions  -0 deletions  ~1 file                                     │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │  10   │  ## Tasks                                                    ││
│  │  11   │  - Build API ✓                                               ││
│  │  12   │  - Write tests ✓                                             ││
│  │  13 + │  - Deploy to staging                        ← Added by You   ││
│  │  14 + │  - Add documentation                        ← Added by Alice ││
│  │  15   │                                                              ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│                                                          [ Close ]       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Notifications

### In-App Notifications

```typescript
interface Notification {
  id: string;
  type: 'document_shared' | 'document_updated' | 'access_revoked' | 'conflict';
  document_id: string;
  document_title: string;
  actor_id: string;
  actor_name: string;
  created_at: string;
  read: boolean;
}
```

**Notification Types:**

| Type | Trigger | Message |
|------|---------|---------|
| `document_shared` | Someone shares doc with you | "Alice shared 'Project Notes' with you" |
| `document_updated` | Collaborator saves changes | "Alice updated 'Project Notes'" |
| `access_revoked` | Owner removes your access | "You no longer have access to 'Project Notes'" |
| `conflict` | Your save had conflicts | "Merge conflict in 'Project Notes'" |

### Notification UI (Header)

```
┌─────────────────────────────────────────────────────┐
│  MD                              🔔(2)  👤 Settings │
└─────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ Notifications                 │
                    ├───────────────────────────────┤
                    │ 🔵 Alice shared "Project      │
                    │    Notes" with you            │
                    │    2 minutes ago              │
                    │                               │
                    │ 🔵 Bob updated "API Specs"    │
                    │    1 hour ago                 │
                    │                               │
                    │ ○ Alice updated "Roadmap"     │
                    │    Yesterday                  │
                    ├───────────────────────────────┤
                    │ Mark all as read              │
                    └───────────────────────────────┘
```

### Future: Email Notifications

Phase 4+ consideration:
- Daily digest of document updates
- Immediate notification for shares
- Configurable in settings

---

## Implementation Phases

### Phase 1: Basic Sharing (MVP)

**Goal**: Share documents, view shared documents, basic editing

**API:**
- [ ] `POST /documents/{id}/share` - Share with email
- [ ] `GET /documents/{id}/shares` - List collaborators
- [ ] `DELETE /documents/{id}/share/{id}` - Revoke access
- [ ] `GET /shared-with-me` - List docs shared with me
- [ ] Update `GET /documents/{id}` to work for collaborators

**Database:**
- [ ] Add `shares` table to user databases
- [ ] Add `shared_documents_index` to global database
- [ ] Add `revisions` table for history

**App UI:**
- [ ] "Share" button in document header
- [ ] Share modal (add/remove collaborators)
- [ ] "Shared with me" section in sidebar
- [ ] Permission badge on shared documents

**Extension UI:**
- [ ] "Save to Cloud" works (no sharing UI in extension for MVP)

**No merge yet** - Last write wins with warning

### Phase 2: Three-Way Merge

**Goal**: Automatic conflict resolution

**API:**
- [ ] Implement `threeWayMerge()` in Go
- [ ] Update `PUT /documents/{id}` to use merge
- [ ] Return conflicts on 409 response
- [ ] `PUT /documents/{id}/resolve` for manual resolution

**App UI:**
- [ ] Conflict resolution modal
- [ ] "Keep yours / Keep theirs / Keep both" options
- [ ] Manual edit option
- [ ] Preview of merged result

**Testing:**
- [ ] Test all merge scenarios
- [ ] Test with large documents
- [ ] Test with binary/special characters

### Phase 3: Revision History

**Goal**: View and restore previous versions

**API:**
- [ ] `GET /documents/{id}/revisions` - List revisions
- [ ] `GET /documents/{id}/revisions/{rev}` - Get revision content
- [ ] `GET /documents/{id}/diff` - Diff between revisions
- [ ] `POST /documents/{id}/restore/{rev}` - Restore revision

**App UI:**
- [ ] "History" button in document header
- [ ] Revision history modal
- [ ] Side-by-side diff view
- [ ] Restore confirmation

**Storage:**
- [ ] Keep last 50 revisions per document
- [ ] Prune older revisions (keep weekly snapshots)

### Phase 4: Notifications & Polish

**Goal**: Keep users informed of changes

**API:**
- [ ] `GET /notifications` - List notifications
- [ ] `PUT /notifications/{id}/read` - Mark as read
- [ ] Webhook/SSE for real-time updates (optional)

**App UI:**
- [ ] Notification bell in header
- [ ] Notification dropdown
- [ ] "Updated by X" indicator on documents
- [ ] Toast notifications for real-time updates

**Extension:**
- [ ] Badge on extension icon for notifications

### Phase 5: Advanced Features (Future)

- [ ] Public sharing (read-only link)
- [ ] Comments on documents
- [ ] Real-time collaborative editing (Yjs)
- [ ] Email notifications
- [ ] Folder sharing
- [ ] Team workspaces

---

## Security Considerations

### Access Control

```typescript
// Every API request checks:
function canAccess(userId: string, documentId: string, action: 'read' | 'write'): boolean {
  // 1. Is user the owner?
  if (isOwner(userId, documentId)) return true;
  
  // 2. Is user a collaborator with permission?
  const share = getShare(documentId, userId);
  if (!share) return false;
  
  if (action === 'read') return true;
  if (action === 'write') return share.permission === 'write';
  
  return false;
}
```

### Data Isolation

- Documents stored in owner's database only
- Collaborators access via API (not direct DB access)
- Global index only stores references, not content

### Share Limits

- Max 10 collaborators per document (MVP)
- Max 100 shared documents per user
- Rate limiting on share operations

---

## Open Questions (Answered)

**Q: What happens to shared doc when owner deletes it?**  
A: Document is soft-deleted. Collaborators see "Document deleted by owner" and it's removed from their list.

**Q: Can collaborators re-share?**  
A: No, only owner can share. Keeps permissions simple.

**Q: What if collaborator edits while offline?**  
A: Local changes saved. On reconnect, merge attempted. If conflict, resolution UI shown.

**Q: What if owner edits while collaborator is editing?**  
A: Same as above - merge on save. No real-time sync in MVP.

**Q: How to handle large documents?**  
A: Same 1MB limit. Merge may be slow for very large docs - show progress.

**Q: What about concurrent saves (race condition)?**  
A: Server uses optimistic locking with revision numbers. Second save gets conflict.

**Q: Can collaborator see revision history?**  
A: Yes, full history visible to all collaborators.

**Q: What happens if owner's account is deleted?**  
A: All documents deleted. Collaborators lose access. (Future: transfer ownership)

---

## Testing Strategy

### Unit Tests

```typescript
describe('threeWayMerge', () => {
  test('no conflict - different sections', () => {
    const base = "A\nB\nC";
    const yours = "A\nX\nC";
    const theirs = "A\nB\nY";
    
    const result = threeWayMerge(base, yours, theirs);
    
    expect(result.success).toBe(true);
    expect(result.merged_content).toBe("A\nX\nY");
  });
  
  test('conflict - same line', () => {
    const base = "A\nB\nC";
    const yours = "A\nX\nC";
    const theirs = "A\nY\nC";
    
    const result = threeWayMerge(base, yours, theirs);
    
    expect(result.success).toBe(false);
    expect(result.conflicts.length).toBe(1);
  });
  
  // ... more tests
});
```

### Integration Tests

- Share document → collaborator can access
- Collaborator edits → owner sees changes
- Concurrent edits → merge or conflict
- Revoke access → collaborator can't access
- Delete document → collaborators notified

### E2E Tests

- Full sharing flow: create → share → edit → merge
- Conflict resolution flow
- Revision history flow

---

## Success Metrics

- [ ] Share document → collaborator sees it within 5 seconds
- [ ] 90% of concurrent edits auto-merge without conflict
- [ ] Conflict resolution completes in < 3 clicks
- [ ] Revision history loads in < 1 second (up to 50 revisions)
- [ ] Zero data loss during merges

---

## Dependencies

- [MD Cloud Sync](./md-cloud-sync.md) Phase 1-2 must be complete
- diff-match-patch library (Go + TypeScript)
- User accounts / authentication (Phase 3 of cloud sync)
