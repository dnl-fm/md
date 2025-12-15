FROM node:20-alpine AS mermaid-builder

# Install mermaid-cli globally
RUN npm install -g @mermaid-js/mermaid-cli

FROM golang:1.21-alpine AS builder

WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

FROM alpine:latest

# Install Node.js for mermaid-cli
RUN apk add --no-cache nodejs npm chromium

# Copy mermaid-cli from builder
COPY --from=mermaid-builder /usr/local/lib/node_modules/@mermaid-js/mermaid-cli /usr/local/lib/node_modules/@mermaid-js/mermaid-cli
RUN ln -s /usr/local/lib/node_modules/@mermaid-js/mermaid-cli/src/cli.js /usr/local/bin/mmdc && \
    chmod +x /usr/local/lib/node_modules/@mermaid-js/mermaid-cli/src/cli.js

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy Go binary
COPY --from=builder /build/server /usr/local/bin/server

EXPOSE 8080

CMD ["server"]
