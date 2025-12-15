# Extension Rendering API

**Status**: Planning  
**Created**: 2025-12-15

## Problem

Browser extension can't load heavy libraries (Shiki 12MB, Mermaid 1.5MB) due to:
- Manifest V3 CSP blocks remote script imports
- Bundle size unacceptable for extension

## Solution

1. **Code highlighting**: Replace Shiki with Prism.js (~20KB)
2. **Mermaid/ASCII**: Server-side rendering via `api.getmd.dev`

---

## Code Highlighting

**Library**: Prism.js  
**Size**: ~20KB (core + common languages)

**Languages to include**:
- javascript, typescript, jsx, tsx
- python, rust, go, php
- bash, shell
- json, yaml, toml
- html, css, sql
- markdown, diff

**Implementation**:
1. Add `prismjs` to extension dependencies
2. Import only needed languages
3. Replace `highlightCodeBlocks()` in content.ts
4. Bundle with Bun

---

## Rendering API

**Base URL**: `https://api.getmd.dev`  
**Auth**: None (rate limited by IP)

### Endpoints

```
GET /render/mermaid/{theme}/{hash}?code={base64}
GET /render/ascii/{hash}?code={base64}
```

- `theme`: `dark` or `light` (mermaid only)
- `hash`: SHA-256 of raw code (hex)
- `code`: Base64-encoded raw code (URL-safe)

### Response

```
Content-Type: image/svg+xml (mermaid)
Content-Type: text/plain (ascii)

<svg>...</svg>
```

Error (400):
```json
{"error": "Invalid mermaid syntax: ..."}
```

### Example

```bash
# Mermaid
CODE=$(echo -n 'graph TD\n  A-->B' | base64)
HASH=$(echo -n 'graph TD\n  A-->B' | sha256sum | cut -d' ' -f1)
curl "https://api.getmd.dev/render/mermaid/dark/${HASH}?code=${CODE}"

# ASCII  
CODE=$(echo -n 'box "Hello"' | base64)
HASH=$(echo -n 'box "Hello"' | sha256sum | cut -d' ' -f1)
curl "https://api.getmd.dev/render/ascii/${HASH}?code=${CODE}"
```

---

## Caching Strategy

**Layer**: Nginx (Go never hit on cache hit)  
**Cache key**: URI path only (excludes query string)  
**Storage**: Filesystem (`/var/cache/nginx/md-api/`)  
**TTL**: 30 days

### Nginx Config

```nginx
proxy_cache_path /var/cache/nginx/md-api levels=1:2 
                 keys_zone=md_render:10m max_size=1g inactive=30d;

server {
    listen 443 ssl;
    server_name api.getmd.dev;

    location /render/ {
        proxy_cache md_render;
        proxy_cache_key "$uri";           # Hash in path = cache key
        proxy_cache_valid 200 30d;
        proxy_cache_valid 400 1m;         # Cache errors briefly
        
        proxy_ignore_headers Cache-Control Expires;
        add_header X-Cache-Status $upstream_cache_status;
        
        proxy_pass http://127.0.0.1:8080;
    }
}
```

### Flow

```
Extension                     Nginx                      Go
    |                           |                         |
    | GET /render/mermaid/dark/abc123?code=...            |
    | ------------------------->|                         |
    |                           |                         |
    |                     [cache check]                   |
    |                           |                         |
    |            HIT:           |                         |
    |   <-- return cached SVG --|                         |
    |                           |                         |
    |            MISS:          |                         |
    |                           |--- proxy to Go -------->|
    |                           |                         |
    |                           |     decode base64       |
    |                           |     exec mermaid-cli    |
    |                           |     return SVG          |
    |                           |                         |
    |                           |<-- SVG -----------------|
    |                     [cache store]                   |
    |   <-- return SVG --------|                         |
```

### Cache Efficiency

- Same code + same theme = same URI = cache hit
- Theme in path means dark/light cached separately
- Hash guarantees correctness (content-addressed)
- No cache invalidation needed

---

## Server Implementation

**Stack**: Go + Nginx  
**Dependencies**:
- `mermaid-cli` - Mermaid rendering (exec)
- Existing ASCII CLI (exec)
- Nginx (caching layer)

### Go Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /render/mermaid/{theme}/{hash}` | Render mermaid diagram |
| `GET /render/ascii/{hash}` | Render ASCII diagram |
| `GET /health` | Health check |

### Rate Limiting (Nginx)

```nginx
limit_req_zone $binary_remote_addr zone=md_limit:10m rate=10r/s;

location /render/ {
    limit_req zone=md_limit burst=50 nodelay;
    # ... rest of config
}
```

### Go Implementation

```go
func renderMermaid(w http.ResponseWriter, r *http.Request) {
    theme := chi.URLParam(r, "theme")  // dark or light
    hash := chi.URLParam(r, "hash")
    codeB64 := r.URL.Query().Get("code")
    
    code, err := base64.URLEncoding.DecodeString(codeB64)
    if err != nil {
        http.Error(w, `{"error":"invalid base64"}`, 400)
        return
    }
    
    // Verify hash matches content
    computed := sha256.Sum256(code)
    if hex.EncodeToString(computed[:]) != hash {
        http.Error(w, `{"error":"hash mismatch"}`, 400)
        return
    }
    
    // Write code to temp file
    tmpFile := filepath.Join(os.TempDir(), hash+".mmd")
    os.WriteFile(tmpFile, code, 0644)
    defer os.Remove(tmpFile)
    
    // Exec mermaid-cli
    outFile := filepath.Join(os.TempDir(), hash+".svg")
    cmd := exec.Command("mmdc", "-i", tmpFile, "-o", outFile, "-t", theme)
    if err := cmd.Run(); err != nil {
        http.Error(w, `{"error":"render failed"}`, 400)
        return
    }
    defer os.Remove(outFile)
    
    svg, _ := os.ReadFile(outFile)
    w.Header().Set("Content-Type", "image/svg+xml")
    w.Write(svg)
}
```

---

## Extension Changes

### Files to modify

1. `packages/extension/package.json` - Add prismjs
2. `packages/extension/src/content.ts`:
   - Replace `highlightCodeBlocks()` with Prism
   - Replace `renderMermaidDiagrams()` with API call
   - Replace `renderAsciiDiagrams()` with API call
3. `packages/extension/manifest.json` - Add `api.getmd.dev` to permissions

### New utilities

```typescript
// src/api.ts
const API_BASE = "https://api.getmd.dev";

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncode(text: string): string {
  return btoa(text)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function renderMermaid(code: string, theme: "dark" | "light"): Promise<string> {
  const hash = await sha256(code);
  const encoded = base64UrlEncode(code);
  
  const response = await fetch(
    `${API_BASE}/render/mermaid/${theme}/${hash}?code=${encoded}`
  );
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error);
  }
  
  return response.text();
}

async function renderAscii(code: string): Promise<string> {
  const hash = await sha256(code);
  const encoded = base64UrlEncode(code);
  
  const response = await fetch(
    `${API_BASE}/render/ascii/${hash}?code=${encoded}`
  );
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error);
  }
  
  return response.text();
}
```

---

## Tasks

### Phase 1: Code Highlighting
- [ ] Add prismjs to extension
- [ ] Configure languages subset
- [ ] Replace highlightCodeBlocks()
- [ ] Test bundle size

### Phase 2: API Server
- [ ] Setup api.getmd.dev (nginx + Go)
- [ ] Implement GET /render/mermaid/{theme}/{hash}
- [ ] Implement GET /render/ascii/{hash}
- [ ] Configure nginx caching
- [ ] Add rate limiting (nginx)
- [ ] Install mermaid-cli, ASCII CLI on server

### Phase 3: Extension Integration
- [ ] Add api.ts utilities
- [ ] Update manifest permissions
- [ ] Replace mermaid/ascii rendering with API calls
- [ ] Add loading states
- [ ] Add error handling (fallback to raw code)
- [ ] Test on various markdown files

---

## Decisions Made

- **Nginx caching**: Cache at nginx layer, Go only hit on cache miss
- **Theme**: In URL path (`/mermaid/dark/` vs `/mermaid/light/`)
- **ASCII renderer**: Reuse existing ASCII CLI via exec
- **Self-hosted**: Go API on own infrastructure

## Open Questions

1. **Batch requests**: Current design is one request per block. Worth adding batch endpoint for fewer round trips? (Could use `Promise.all` client-side for now)
2. **Max code size**: What's reasonable limit? 10KB? 50KB?
