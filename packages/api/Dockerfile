FROM golang:1.21-alpine AS builder

WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Final stage with headless-shell
FROM chromedp/headless-shell:stable

# Copy Go binary
COPY --from=builder /build/server /usr/local/bin/server

# Set environment for chromedp
ENV CHROME_BIN=/headless-shell/headless-shell
ENV CHROME_PATH=/headless-shell/headless-shell

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080

CMD ["server"]
