.PHONY: build run test docker-build docker-run clean deps

# Build the server
build:
	go build -o bin/server ./cmd/server

# Run the server locally
run:
	go run ./cmd/server

# Run tests
test:
	go test -v ./...

# Build Docker image
docker-build:
	docker build -t md-api:latest .

# Run Docker container
docker-run:
	docker run -p 8080:8080 md-api:latest

# Install dependencies
deps:
	go mod download
	go mod tidy

# Clean build artifacts
clean:
	rm -rf bin/

# Development with auto-reload (requires air)
dev:
	air
