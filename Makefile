.PHONY: dev build build-wasm serve test test-watch install clean lint typecheck codequality help

# Development
dev:
	bun run dev

# Build
build:
	bun run build

build-wasm:
	bun run build:wasm

# Preview built app
serve:
	bun run serve

# Testing
test:
	bun test

test-watch:
	bun test --watch

# Setup
install:
	bun install

# Cleanup
clean:
	rm -rf dist node_modules src/wasm-pkg
	cd src-tauri && cargo clean

# Linting & type checking
typecheck:
	bunx tsc --noEmit

lint:
	cd src-tauri && cargo clippy

# Code quality (lint + tests)
codequality: typecheck lint test

# Logs
logs:
	tail -f ~/.md/md.log

# Version info
version:
	@echo "package.json:   $$(jq -r .version package.json)"
	@echo "Cargo.toml:     $$(grep '^version' src-tauri/Cargo.toml | head -1 | cut -d'"' -f2)"
	@echo "tauri.conf.json: $$(jq -r .version src-tauri/tauri.conf.json)"

# Help
help:
	@echo "Available targets:"
	@echo "  dev         - Start dev server + Tauri"
	@echo "  build       - Production build (wasm + tauri)"
	@echo "  build-wasm  - Build WASM module only"
	@echo "  serve       - Preview built app"
	@echo "  test        - Run tests"
	@echo "  test-watch  - Run tests in watch mode"
	@echo "  install     - Install dependencies"
	@echo "  clean       - Remove build artifacts"
	@echo "  typecheck   - TypeScript type check"
	@echo "  lint        - Rust clippy"
	@echo "  codequality - Run typecheck, lint, and tests"
	@echo "  logs        - Tail log file"
	@echo "  version     - Show versions across files"
	@echo "  help        - Show this help"
