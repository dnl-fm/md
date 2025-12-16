# Deployment Guide

## Server Setup (Ubuntu/Debian)

### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Go
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install mermaid-cli
sudo npm install -g @mermaid-js/mermaid-cli

# Install Chromium (required by mermaid-cli)
sudo apt install -y chromium-browser

# Install Nginx
sudo apt install -y nginx

# Install certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Build and Deploy API

```bash
# Create deployment directory
sudo mkdir -p /opt/md-api
cd /opt/md-api

# Clone repository (or copy files)
# Build binary
go build -o server ./cmd/server

# Create systemd service
sudo tee /etc/systemd/system/md-api.service > /dev/null <<EOF
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
Environment="PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser"

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable md-api
sudo systemctl start md-api
sudo systemctl status md-api
```

### 3. Configure Nginx

```bash
# Create cache directory
sudo mkdir -p /var/cache/nginx/md-api
sudo chown www-data:www-data /var/cache/nginx/md-api

# Create nginx config
sudo tee /etc/nginx/sites-available/api.getmd.dev > /dev/null <<'EOF'
# Cache configuration
proxy_cache_path /var/cache/nginx/md-api 
                 levels=1:2 
                 keys_zone=md_render:10m 
                 max_size=1g 
                 inactive=30d 
                 use_temp_path=off;

# Rate limiting
limit_req_zone $binary_remote_addr zone=md_limit:10m rate=10r/s;

# Upstream
upstream md_api {
    server 127.0.0.1:8080;
    keepalive 32;
}

server {
    listen 80;
    server_name api.getmd.dev;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.getmd.dev;

    # SSL certificates (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/api.getmd.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.getmd.dev/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Accept, Content-Type' always;

    # Render endpoints (cached)
    location /render/ {
        # Rate limiting
        limit_req zone=md_limit burst=50 nodelay;
        limit_req_status 429;

        # Caching
        proxy_cache md_render;
        proxy_cache_key "$uri";
        proxy_cache_valid 200 30d;
        proxy_cache_valid 400 1m;
        proxy_cache_valid 429 1m;
        proxy_cache_lock on;
        proxy_cache_lock_timeout 10s;
        
        # Ignore upstream cache headers
        proxy_ignore_headers Cache-Control Expires Set-Cookie;
        
        # Add cache status header
        add_header X-Cache-Status $upstream_cache_status always;

        # Proxy to Go API
        proxy_pass http://md_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check (not cached)
    location /health {
        proxy_pass http://md_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        access_log off;
    }

    # OPTIONS for CORS preflight
    location / {
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Accept, Content-Type' always;
            add_header 'Access-Control-Max-Age' 300;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/api.getmd.dev /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d api.getmd.dev

# Restart nginx
sudo systemctl restart nginx
```

### 4. Firewall Configuration

```bash
# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### 5. Monitoring

```bash
# View API logs
sudo journalctl -u md-api -f

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check cache stats
sudo du -sh /var/cache/nginx/md-api/
```

## Testing Deployment

```bash
# Health check
curl https://api.getmd.dev/health

# Test mermaid rendering
CODE="graph TD
  A-->B"
HASH=$(echo -n "$CODE" | sha256sum | cut -d' ' -f1)
ENCODED=$(echo -n "$CODE" | base64 | tr '+/' '-_' | tr -d '=')

curl -v "https://api.getmd.dev/render/mermaid/dark/${HASH}?code=${ENCODED}" -o test.svg

# Check cache hit (should have X-Cache-Status: HIT on second request)
curl -v "https://api.getmd.dev/render/mermaid/dark/${HASH}?code=${ENCODED}" -o test2.svg
```

## Maintenance

### Update API

```bash
cd /opt/md-api
git pull
go build -o server ./cmd/server
sudo systemctl restart md-api
```

### Clear Cache

```bash
# Clear all cache
sudo rm -rf /var/cache/nginx/md-api/*

# Reload nginx
sudo systemctl reload nginx
```

### SSL Certificate Renewal

Certbot auto-renews. To test:

```bash
sudo certbot renew --dry-run
```

## Troubleshooting

### Check if API is running
```bash
sudo systemctl status md-api
curl http://localhost:8080/health
```

### Check if mermaid-cli works
```bash
echo "graph TD; A-->B" > test.mmd
mmdc -i test.mmd -o test.svg
```

### Check nginx configuration
```bash
sudo nginx -t
```

### View detailed logs
```bash
# API logs
sudo journalctl -u md-api -n 100 --no-pager

# Nginx error log
sudo tail -n 100 /var/log/nginx/error.log
```
