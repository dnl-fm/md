# Chromedp Mermaid Rendering

**Goal:** Replace mmdc CLI with chromedp for faster, lighter mermaid rendering.

## Why Change?

We tested multiple approaches for server-side mermaid rendering:

| Method | Cold | Warm | Memory | Image Size |
|--------|------|------|--------|------------|
| mmdc (current) | 870ms | 870ms | ~150MB | N/A |
| kroki-mermaid | 115ms | 115ms | 170MB | 1.06GB |
| **chromedp + headless-shell** | 286ms | **60-100ms** | **65MB** | **310MB** |

**chromedp wins:**
- Fastest warm renders (60-100ms)
- 3x less memory than kroki
- 3x smaller container image
- Pure Go (no Node.js/mmdc dependency)
- No sandbox issues (Chrome runs in container)

---

## Architecture

```
┌─────────────────┐      ┌─────────────────────┐
│  Go API Server  │─CDP─▶│  headless-shell     │
│  (chromedp)     │      │  (Chrome container) │
│                 │      │  Port 9222          │
│  Port 8080      │      └─────────────────────┘
└─────────────────┘
```

**Key optimization:** Keep browser page warm, reuse for multiple renders.

---

## Implementation

### 1. Update go.mod

Add chromedp dependency:

```bash
cd packages/api
go get github.com/chromedp/chromedp
```

### 2. Create renderer package

Create `packages/api/internal/renderer/mermaid.go`:

```go
package renderer

import (
    "context"
    "fmt"
    "sync"
    "time"

    "github.com/chromedp/chromedp"
)

type MermaidRenderer struct {
    allocCtx context.Context
    cancel   context.CancelFunc
    mu       sync.Mutex
    
    // Warm page for fast renders
    pageCtx    context.Context
    pageCancel context.CancelFunc
}

func NewMermaidRenderer(wsURL string) (*MermaidRenderer, error) {
    allocCtx, cancel := chromedp.NewRemoteAllocator(context.Background(), wsURL)
    
    r := &MermaidRenderer{
        allocCtx: allocCtx,
        cancel:   cancel,
    }
    
    // Initialize warm page
    if err := r.warmUp(); err != nil {
        cancel()
        return nil, err
    }
    
    return r, nil
}

func (r *MermaidRenderer) warmUp() error {
    r.pageCtx, r.pageCancel = chromedp.NewContext(r.allocCtx)
    
    // Load mermaid.js once
    html := `<!DOCTYPE html>
<html><head>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head><body>
<pre class="mermaid" id="diagram"></pre>
<script>
mermaid.initialize({ startOnLoad: false });
async function render(code, theme) {
    const el = document.getElementById('diagram');
    el.textContent = code;
    el.removeAttribute('data-processed');
    mermaid.initialize({ startOnLoad: false, theme: theme });
    await mermaid.run({ nodes: [el] });
    return document.querySelector('svg').outerHTML;
}
</script>
</body></html>`

    ctx, cancel := context.WithTimeout(r.pageCtx, 30*time.Second)
    defer cancel()

    return chromedp.Run(ctx,
        chromedp.Navigate("data:text/html,"+html),
        chromedp.WaitVisible("#diagram", chromedp.ByID),
    )
}

func (r *MermaidRenderer) Render(code, theme string) ([]byte, error) {
    r.mu.Lock()
    defer r.mu.Unlock()

    // Map theme: our API uses dark/light, mermaid uses dark/default
    mermaidTheme := theme
    if theme == "light" {
        mermaidTheme = "default"
    }

    ctx, cancel := context.WithTimeout(r.pageCtx, 15*time.Second)
    defer cancel()

    var svg string
    err := chromedp.Run(ctx,
        chromedp.Evaluate(
            fmt.Sprintf(`render(%q, %q)`, code, mermaidTheme),
            &svg,
            chromedp.EvalAsValue,
        ),
    )
    if err != nil {
        // Try to recover by re-warming
        r.pageCancel()
        if warmErr := r.warmUp(); warmErr != nil {
            return nil, fmt.Errorf("render failed and recovery failed: %w", err)
        }
        return nil, err
    }

    return []byte(svg), nil
}

func (r *MermaidRenderer) Close() {
    if r.pageCancel != nil {
        r.pageCancel()
    }
    if r.cancel != nil {
        r.cancel()
    }
}
```

### 3. Update handlers

Update `packages/api/internal/handlers/handlers.go`:

```go
package handlers

import (
    "crypto/sha256"
    "encoding/base64"
    "encoding/hex"
    "encoding/json"
    "net/http"

    "github.com/dnl-fm/md/packages/api/internal/renderer"
    "github.com/go-chi/chi/v5"
)

var mermaidRenderer *renderer.MermaidRenderer

func InitRenderer(wsURL string) error {
    var err error
    mermaidRenderer, err = renderer.NewMermaidRenderer(wsURL)
    return err
}

func CloseRenderer() {
    if mermaidRenderer != nil {
        mermaidRenderer.Close()
    }
}

func RenderMermaid(w http.ResponseWriter, r *http.Request) {
    theme := chi.URLParam(r, "theme")
    hash := chi.URLParam(r, "hash")
    codeB64 := r.URL.Query().Get("code")

    // Validate theme
    if theme != "dark" && theme != "light" {
        respondError(w, "invalid theme", http.StatusBadRequest)
        return
    }

    // Decode base64
    code, err := base64.RawURLEncoding.DecodeString(codeB64)
    if err != nil {
        code, err = base64.URLEncoding.DecodeString(codeB64)
        if err != nil {
            respondError(w, "invalid base64", http.StatusBadRequest)
            return
        }
    }

    // Verify hash
    computed := sha256.Sum256(code)
    if hex.EncodeToString(computed[:]) != hash {
        respondError(w, "hash mismatch", http.StatusBadRequest)
        return
    }

    // Render using chromedp
    svg, err := mermaidRenderer.Render(string(code), theme)
    if err != nil {
        respondError(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "image/svg+xml")
    w.Header().Set("Cache-Control", "public, max-age=2592000")
    w.Write(svg)
}
```

### 4. Update main.go

```go
package main

import (
    "log"
    "net/http"
    "os"

    "github.com/dnl-fm/md/packages/api/internal/handlers"
    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
)

func main() {
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    // Chrome WebSocket URL (headless-shell container)
    wsURL := os.Getenv("CHROME_WS_URL")
    if wsURL == "" {
        wsURL = "ws://localhost:9222"
    }

    // Initialize mermaid renderer
    if err := handlers.InitRenderer(wsURL); err != nil {
        log.Fatalf("Failed to initialize renderer: %v", err)
    }
    defer handlers.CloseRenderer()

    r := chi.NewRouter()
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)

    r.Get("/health", handlers.Health)
    r.Get("/render/mermaid/{theme}/{hash}", handlers.RenderMermaid)

    log.Printf("Starting server on :%s", port)
    log.Fatal(http.ListenAndServe(":"+port, r))
}
```

### 5. Update Dockerfile

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o server ./cmd/server

FROM alpine:latest
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/server /server
EXPOSE 8080
CMD ["/server"]
```

### 6. Update docker-compose.yml (or deployment)

```yaml
version: '3.8'
services:
  headless-shell:
    image: chromedp/headless-shell:latest
    restart: unless-stopped
    ports:
      - "9222:9222"
    # Resource limits
    deploy:
      resources:
        limits:
          memory: 256M

  api:
    build: .
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - CHROME_WS_URL=ws://headless-shell:9222
    depends_on:
      - headless-shell
```

---

## Testing

### Local Testing

```bash
# Start headless-shell
docker run -d --name headless-shell -p 9222:9222 chromedp/headless-shell:latest

# Run API
cd packages/api
CHROME_WS_URL=ws://localhost:9222 go run ./cmd/server

# Test
CODE='graph TD; A-->B'
HASH=$(echo -n "$CODE" | sha256sum | cut -d' ' -f1)
ENCODED=$(echo -n "$CODE" | base64 -w0 | tr '+/' '-_' | tr -d '=')
curl "http://localhost:8080/render/mermaid/dark/${HASH}?code=${ENCODED}"
```

### Benchmark

Expected performance:
- Cold (first request): ~300ms
- Warm (subsequent): ~60-100ms

---

## Cleanup

Remove from current implementation:
- [ ] Remove mmdc/puppeteer config from handlers
- [ ] Remove mermaid-cli from Dockerfile
- [ ] Update DEPLOYMENT.md

---

## Summary

| Before (mmdc) | After (chromedp) |
|---------------|------------------|
| Shell out to mmdc | Native Go |
| ~870ms per render | ~60-100ms warm |
| Node.js + Puppeteer | headless-shell only |
| Sandbox issues | No issues (containerized) |
