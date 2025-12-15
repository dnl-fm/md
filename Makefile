.PHONY: dev build build-wasm build-ext serve test test-watch install clean lint typecheck codequality help

APP_DIR = packages/app
EXT_DIR = packages/extension

# Development
dev:
	cd $(APP_DIR) && bun run dev --watch

# Build
build:
	cd $(APP_DIR) && bun run build

build-wasm:
	cd $(APP_DIR) && bun run build:wasm

build-ext:
	cd $(EXT_DIR) && bun run build

# Preview built app
serve:
	cd $(APP_DIR) && bun run serve

# Testing
test:
	cd $(APP_DIR) && bun test

test-watch:
	cd $(APP_DIR) && bun test --watch

# Setup
install:
	bun install

# Cleanup
clean:
	rm -rf node_modules
	rm -rf $(APP_DIR)/dist $(APP_DIR)/node_modules $(APP_DIR)/src/wasm-pkg
	rm -rf $(EXT_DIR)/dist $(EXT_DIR)/node_modules
	cd $(APP_DIR)/src-tauri && cargo clean

# Linting & type checking
typecheck:
	cd $(APP_DIR) && bunx tsc --noEmit

lint:
	cd $(APP_DIR)/src-tauri && cargo clippy

# Code quality (lint + tests)
codequality: typecheck lint test

# Logs
logs:
	tail -f ~/.md/md.log

# Version info
version:
	@echo "root package.json:    $$(jq -r .version package.json)"
	@echo "app package.json:     $$(jq -r .version $(APP_DIR)/package.json)"
	@echo "Cargo.toml:           $$(grep '^version' $(APP_DIR)/src-tauri/Cargo.toml | head -1 | cut -d'"' -f2)"
	@echo "tauri.conf.json:      $$(jq -r .version $(APP_DIR)/src-tauri/tauri.conf.json)"
	@echo "extension:            $$(jq -r .version $(EXT_DIR)/package.json)"

# Help
help:
	@echo "Available targets:"
	@echo "  dev         - Start dev server + Tauri"
	@echo "  build       - Production build (wasm + tauri)"
	@echo "  build-wasm  - Build WASM module only"
	@echo "  build-ext   - Build Chrome extension"
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
