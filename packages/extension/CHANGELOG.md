# Changelog

All notable changes to the MD browser extension will be documented in this file.

## [0.1.0] - 2025-12-15

### Added
- Initial release of MD browser extension
- **Markdown rendering** for raw `.md` URLs (GitHub, GitLab, Gitea, etc.)
- **Syntax highlighting** via Shiki (loaded from esm.sh CDN)
- **Mermaid diagrams** support (loaded from esm.sh CDN)
- **Table of Contents** panel (Ctrl+G)
- **Theme support** - Dark/light with system preference detection
- **Print/PDF export** (Ctrl+P) with optimized print styles
- **Raw view** toggle (Ctrl+U) to see original markdown source
- **Font size controls** (+/- buttons and Ctrl++/-)
- **Full width toggle** (default: on)
- **Help modal** (Ctrl+H) with keyboard shortcuts
- **Persistent settings** via `chrome.storage.local` (synced across all URLs)

### Supported URL Patterns
- `*://*/*.md` and `*://*/*.markdown`
- `raw.githubusercontent.com/*`
- `gist.githubusercontent.com/*`

### Known Limitations
- No `file://` URL support (CDN-loaded libs blocked by CORS)
- Use MD desktop app for local markdown files
