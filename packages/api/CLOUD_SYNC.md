## Cloud Sync API

Server-side storage and synchronization for markdown documents.

## Overview

The Cloud Sync API allows MD browser extension and desktop app users to save and sync their markdown documents across devices. Documents are stored in per-user SQLite databases on the server.

## Development Mode

During development, authentication is bypassed using a hardcoded user ID.

**Enable dev mode:**
```bash
# Set environment variables
export MD_DEV_MODE=true
export DATA_DIR=./data

# Use X-Dev-User header in requests
curl -H "X-Dev-User: dev-user-001" https://api.getmd.dev/v1/cloud/documents
```

**Production:** Uses JWT authentication (Phase 2)

## Base URL

```
https://api.getmd.dev/v1/cloud
```

## Authentication

### Development
```
X-Dev-User: dev-user-001
```

### Production (Phase 2)
```
Authorization: Bearer {jwt_token}
```

## Endpoints

### List Documents

Get all documents for the authenticated user.

```http
GET /documents

Headers:
  X-Dev-User: dev-user-001

Query Parameters:
  since: ISO timestamp (optional) - Only return docs updated after this time
  include_deleted: boolean (optional) - Include soft-deleted documents

Response: 200 OK
{
  "documents": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "My Document",
      "source_url": "https://github.com/...",
      "created_at": "2025-12-16T12:00:00Z",
      "updated_at": "2025-12-16T12:30:00Z",
      "accessed_at": "2025-12-16T12:30:00Z",
      "content_hash": "abc123...",
      "size_bytes": 1234,
      "word_count": 256,
      "is_deleted": false
    }
  ],
  "sync_token": "2025-12-16T12:30:00Z"
}
```

### Get Document

Get full content of a specific document.

```http
GET /documents/{id}

Headers:
  X-Dev-User: dev-user-001

Response: 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My Document",
  "content": "# Full markdown content...",
  "source_url": "https://github.com/...",
  "created_at": "2025-12-16T12:00:00Z",
  "updated_at": "2025-12-16T12:30:00Z",
  "accessed_at": "2025-12-16T12:30:00Z",
  "content_hash": "abc123...",
  "size_bytes": 1234,
  "word_count": 256
}

Response: 404 Not Found
{
  "error": "document not found"
}
```

### Create Document

Save a new document to cloud storage.

```http
POST /documents

Headers:
  X-Dev-User: dev-user-001
  Content-Type: application/json

Body:
{
  "title": "My New Document",
  "content": "# Markdown content...",
  "source_url": "https://github.com/..." (optional)
}

Response: 201 Created
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My New Document",
  "content": "# Markdown content...",
  "created_at": "2025-12-16T12:00:00Z",
  "updated_at": "2025-12-16T12:00:00Z",
  "content_hash": "abc123...",
  "size_bytes": 1234,
  "word_count": 256
}

Response: 400 Bad Request
{
  "error": "title is required"
}
```

### Update Document

Update an existing document.

```http
PUT /documents/{id}

Headers:
  X-Dev-User: dev-user-001
  Content-Type: application/json

Body:
{
  "title": "Updated Title" (optional),
  "content": "# Updated content..." (optional),
  "base_hash": "abc123..." (optional, for conflict detection)
}

Response: 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "updated_at": "2025-12-16T12:35:00Z",
  "content_hash": "def456..."
}

Response: 409 Conflict (if base_hash doesn't match)
{
  "error": "conflict",
  "server_hash": "xyz789...",
  "server_updated_at": "2025-12-16T12:33:00Z"
}

Response: 404 Not Found
{
  "error": "document not found"
}
```

### Delete Document

Soft-delete a document (marks as deleted, doesn't remove data).

```http
DELETE /documents/{id}

Headers:
  X-Dev-User: dev-user-001

Response: 204 No Content

Response: 404 Not Found
{
  "error": "document not found"
}
```

## Data Model

### Document Fields

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique document identifier |
| title | string | Document title (from H1 or filename) |
| content | string | Full markdown content |
| source_url | string? | Original URL (if saved from extension) |
| created_at | datetime | When document was created |
| updated_at | datetime | Last modification time |
| accessed_at | datetime | Last time document was opened |
| content_hash | string | SHA-256 hash of content |
| size_bytes | integer | Content size in bytes |
| word_count | integer | Approximate word count |
| is_deleted | boolean | Soft delete flag |
| deleted_at | datetime? | When document was deleted |

### Content Hash

SHA-256 hash of document content, used for:
- Change detection (did content actually change?)
- Conflict detection (optimistic locking)
- Sync optimization (skip unchanged docs)

## Storage

### Per-User Databases

Each user gets their own SQLite database:

```
data/
└── users/
    ├── dev-user-001/
    │   └── documents.db
    ├── user-123/
    │   └── documents.db
    └── ...
```

### Database Schema

```sql
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    content_hash TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    word_count INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at DATETIME
);

CREATE INDEX idx_documents_updated_at ON documents(updated_at);
CREATE INDEX idx_documents_accessed_at ON documents(accessed_at);
CREATE INDEX idx_documents_is_deleted ON documents(is_deleted);
```

## Testing

### Manual Testing

```bash
# Start server in dev mode
cd packages/api
DATA_DIR=./data go run ./cmd/server

# In another terminal:
USER="dev-user-001"

# Create a document
curl -X POST http://localhost:8080/v1/cloud/documents \
  -H "X-Dev-User: $USER" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Document",
    "content": "# Hello World\n\nThis is a test."
  }'

# List documents
curl -H "X-Dev-User: $USER" http://localhost:8080/v1/cloud/documents

# Get specific document
DOC_ID="..." # ID from create response
curl -H "X-Dev-User: $USER" http://localhost:8080/v1/cloud/documents/$DOC_ID

# Update document
curl -X PUT http://localhost:8080/v1/cloud/documents/$DOC_ID \
  -H "X-Dev-User: $USER" \
  -H "Content-Type: application/json" \
  -d '{"content": "# Updated\n\nNew content."}'

# Delete document
curl -X DELETE http://localhost:8080/v1/cloud/documents/$DOC_ID \
  -H "X-Dev-User: $USER"
```

### Automated Tests

```bash
cd packages/api
go test -v ./internal/handlers/... -run TestCloud
```

## Deployment

### Environment Variables

```bash
# Server port (default: 8080)
PORT=8080

# Data directory for SQLite databases (default: ./data)
DATA_DIR=/opt/md-api/data

# Dev mode (default: false)
MD_DEV_MODE=true
```

### Docker

```bash
docker run -d \
  --name md-api \
  -p 8080:8080 \
  -v /opt/md-api/data:/data \
  -e DATA_DIR=/data \
  -e MD_DEV_MODE=true \
  md-api:latest
```

### Nginx Configuration

Add cloud sync routes to existing nginx config:

```nginx
location /v1/cloud/ {
    # No caching for cloud sync (always fresh data)
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Backup

### SQLite Backup

```bash
# Backup single user
sqlite3 data/users/dev-user-001/documents.db ".backup backup.db"

# Backup all users
tar -czf backups/users-$(date +%Y%m%d).tar.gz data/users/
```

### Restore

```bash
# Restore single user
cp backup.db data/users/dev-user-001/documents.db

# Restore all users
tar -xzf backups/users-20251216.tar.gz
```

## Future Enhancements (Phase 2+)

- JWT authentication with getmd.dev
- Real-time sync via WebSockets
- Batch sync endpoint
- Document sharing
- Conflict resolution UI
- Encryption at rest
- Document history/versions
- Search across documents
- Tags and collections

## Support

For issues or questions:
- GitHub: https://github.com/dnl-fm/md/issues
- Docs: https://github.com/dnl-fm/md/tree/main/docs/plans/md-cloud-sync.md
