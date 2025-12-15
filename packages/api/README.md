# MD Rendering API

Server-side rendering API for Mermaid diagrams and ASCII art.

## Endpoints

### Health Check
```
GET /health
```

Returns: `{"status": "ok"}`

### Render Mermaid Diagram
```
GET /render/mermaid/{theme}/{hash}?code={base64}
```

- `theme`: `dark` or `light`
- `hash`: SHA-256 hash of raw code (hex)
- `code`: Base64-encoded diagram code (URL-safe)

Returns: SVG image

### Render ASCII Diagram
```
GET /render/ascii/{hash}?code={base64}
```

- `hash`: SHA-256 hash of raw code (hex)
- `code`: Base64-encoded diagram code (URL-safe)

Returns: Plain text rendered diagram

## Example Usage

### Mermaid
```bash
CODE="graph TD
  A-->B"
HASH=$(echo -n "$CODE" | sha256sum | cut -d' ' -f1)
ENCODED=$(echo -n "$CODE" | base64 | tr '+/' '-_' | tr -d '=')

curl "http://localhost:8080/render/mermaid/dark/${HASH}?code=${ENCODED}"
```

### ASCII
```bash
CODE='box "Hello"'
HASH=$(echo -n "$CODE" | sha256sum | cut -d' ' -f1)
ENCODED=$(echo -n "$CODE" | base64 | tr '+/' '-_' | tr -d '=')

curl "http://localhost:8080/render/ascii/${HASH}?code=${ENCODED}"
```

## Development

### Prerequisites
- Go 1.21+
- Node.js 20+ (for mermaid-cli)
- mermaid-cli: `npm install -g @mermaid-js/mermaid-cli`

### Run Locally
```bash
make deps    # Install dependencies
make build   # Build binary
make run     # Run server
```

Server runs on port 8080 (configurable via `PORT` env var).

### Docker
```bash
make docker-build   # Build image
make docker-run     # Run container
```

## Deployment

### Nginx Configuration

```nginx
proxy_cache_path /var/cache/nginx/md-api levels=1:2 
                 keys_zone=md_render:10m max_size=1g inactive=30d;

limit_req_zone $binary_remote_addr zone=md_limit:10m rate=10r/s;

server {
    listen 443 ssl;
    server_name api.getmd.dev;

    ssl_certificate /etc/letsencrypt/live/api.getmd.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.getmd.dev/privkey.pem;

    location /render/ {
        limit_req zone=md_limit burst=50 nodelay;
        
        proxy_cache md_render;
        proxy_cache_key "$uri";
        proxy_cache_valid 200 30d;
        proxy_cache_valid 400 1m;
        
        proxy_ignore_headers Cache-Control Expires;
        add_header X-Cache-Status $upstream_cache_status;
        
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /health {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

### systemd Service

```ini
[Unit]
Description=MD Rendering API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/md-api
ExecStart=/opt/md-api/server
Restart=always
RestartSec=5
Environment="PORT=8080"

[Install]
WantedBy=multi-user.target
```

## Caching Strategy

- **Layer**: Nginx (upstream never hit on cache hit)
- **Cache key**: URI path (hash in URL ensures correctness)
- **TTL**: 30 days for successful renders, 1 minute for errors
- **Storage**: Filesystem-backed nginx cache
- **Invalidation**: Not needed (content-addressed by hash)

## Security

- Rate limiting: 10 req/s per IP (burst 50)
- Hash verification prevents cache poisoning
- Input validation on all parameters
- Sandboxed rendering (mermaid-cli runs in isolated process)
