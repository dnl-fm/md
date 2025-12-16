# chromedp Mermaid Rendering

## Overview

The API now uses chromedp with a warm browser page for fast mermaid diagram rendering.

## Performance Comparison

| Method | Avg Render Time | Image Size | Memory Usage |
|--------|----------------|------------|--------------|
| mmdc (old) | ~870ms | ~500MB | ~200MB |
| kroki-mermaid | ~115ms | ~1GB | ~500MB |
| **chromedp (current)** | **60-100ms** | **310MB** | **65MB** |

**Improvements:**
- 8-14x faster than mmdc
- 62% smaller image than kroki
- 67% less memory than kroki

## Architecture

### Warm Page Optimization

Instead of spawning a new browser for each render:
1. Server starts with headless Chrome already running
2. Mermaid library pre-loaded in a warm page
3. Each render reuses the same browser context
4. Only the diagram code changes between renders

### Flow

```
Server Start
    ↓
Initialize chromedp context
    ↓
Load HTML with Mermaid CDN
    ↓
Wait for mermaid library ready
    ↓
[Warm page ready - ~2s startup]
    
Request arrives
    ↓
Lock renderer (thread-safe)
    ↓
Set theme + code in JavaScript
    ↓
Execute mermaid.render()
    ↓
Return SVG (60-100ms)
    ↓
Unlock renderer
```

## Implementation Details

### MermaidRenderer

**File:** `internal/renderer/mermaid.go`

```go
type MermaidRenderer struct {
    ctx    context.Context    // Warm browser context
    cancel context.CancelFunc
    mu     sync.Mutex         // Thread-safe rendering
    ready  bool
}
```

**Methods:**
- `NewMermaidRenderer()` - Creates warm browser context
- `warmup()` - Loads mermaid library from CDN
- `Render(code, theme)` - Fast render using warm page
- `Close()` - Cleanup browser context

### Thread Safety

Uses `sync.Mutex` to ensure:
- Only one render happens at a time
- No race conditions on browser context
- Safe shutdown

### Error Handling

- Warmup timeout: 10 seconds (library load)
- Render timeout: 30 seconds (per diagram)
- Returns descriptive errors for invalid syntax
- Automatic cleanup on context cancel

## Docker Image

### Base Image: chromedp/headless-shell

**Benefits:**
- Minimal Chrome build (no GUI, no extras)
- 310MB image size
- Built specifically for chromedp
- Well-maintained, security updates

**Dockerfile:**
```dockerfile
FROM chromedp/headless-shell:stable

COPY --from=builder /build/server /usr/local/bin/server

ENV CHROME_BIN=/headless-shell/headless-shell
ENV CHROME_PATH=/headless-shell/headless-shell

CMD ["server"]
```

## Development

### Local Testing (without Docker)

Requires Chrome/Chromium installed:

```bash
# Install Chrome (macOS)
brew install --cask google-chrome

# Install Chrome (Ubuntu/Debian)
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install google-chrome-stable

# Run server
go run ./cmd/server
```

### With Docker Compose

```bash
docker-compose up --build
```

Server will be available at `http://localhost:8080`

## Testing

### Manual Test

```bash
# Start server
go run ./cmd/server

# In another terminal
CODE="graph TD
  A-->B"
HASH=$(echo -n "$CODE" | sha256sum | cut -d' ' -f1)
ENCODED=$(echo -n "$CODE" | base64 | tr '+/' '-_' | tr -d '=')

# First render (warm page, ~60-100ms)
time curl "http://localhost:8080/render/mermaid/dark/${HASH}?code=${ENCODED}" -o test1.svg

# Second render (should be similar, ~60-100ms)
time curl "http://localhost:8080/render/mermaid/dark/${HASH}?code=${ENCODED}" -o test2.svg
```

### Load Testing

```bash
# Install hey (HTTP load tester)
go install github.com/rakyll/hey@latest

# Test with 100 concurrent requests
CODE="graph TD
  A-->B"
HASH=$(echo -n "$CODE" | sha256sum | cut -d' ' -f1)
ENCODED=$(echo -n "$CODE" | base64 | tr '+/' '-_' | tr -d '=')

hey -n 1000 -c 10 "http://localhost:8080/render/mermaid/dark/${HASH}?code=${ENCODED}"
```

Expected results:
- Average latency: 60-100ms (warm renders)
- p95 latency: <150ms
- p99 latency: <200ms

## Memory Usage

### Baseline
- Go server: ~10MB
- Headless Chrome: ~50MB
- Warm page with Mermaid: ~5MB
- **Total: ~65MB**

### Under Load
- Additional 1-2MB per concurrent render
- 10 concurrent: ~85MB
- 50 concurrent: ~165MB

### Recommendations
- Docker limit: 512MB (allows ~80 concurrent renders)
- Production: Monitor with Prometheus/Grafana
- Alert if memory > 400MB sustained

## Monitoring

### Health Check

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

### Metrics to Track

1. **Render Latency**
   - Target: <100ms p95
   - Alert if p95 >200ms

2. **Memory Usage**
   - Target: <100MB baseline
   - Alert if >400MB sustained

3. **Error Rate**
   - Target: <1% errors
   - Alert if >5% errors

4. **Concurrent Renders**
   - Track active renders
   - Alert if queue grows

## Troubleshooting

### "Renderer not ready"

**Cause:** Server started but warmup failed

**Solution:**
```bash
# Check Chrome is accessible
which google-chrome

# Check logs
journalctl -u md-api -n 100
```

### Slow renders (>500ms)

**Cause:** Chrome process struggling (CPU/memory)

**Solution:**
- Check CPU usage: `top`
- Check memory: `free -h`
- Restart service: `systemctl restart md-api`
- Scale horizontally (more instances)

### "Context deadline exceeded"

**Cause:** Complex diagram taking >30s

**Solution:**
- Increase timeout in `mermaid.go`:
  ```go
  ctx, cancel := context.WithTimeout(r.ctx, 60*time.Second)
  ```

## Production Deployment

### systemd Service

Update to set Chrome path:

```ini
[Service]
Environment="PORT=8080"
Environment="CHROME_BIN=/usr/bin/google-chrome"
```

### Docker

```bash
# Build
docker build -t md-api:chromedp .

# Run with memory limit
docker run -p 8080:8080 --memory=512m md-api:chromedp
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: md-api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: md-api:chromedp
        resources:
          limits:
            memory: 512Mi
            cpu: 500m
          requests:
            memory: 256Mi
            cpu: 250m
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
```

## Credits

Implementation based on performance testing by Pi:
- Tested mmdc, kroki-mermaid, and chromedp
- chromedp with headless-shell emerged as winner
- 60-100ms warm, 310MB image, 65MB memory
