# Changelog

All notable changes to the MD browser extension will be documented in this file.

## [0.1.1] - 2025-12-16

### Fixed
- **ASCII diagrams with cycles** - Back-edges (e.g., `D --> A`) now render correctly with loopback arrows instead of crashing
- **ASCII table emoji alignment** - Unicode emoji (✅, ❌, etc.) now sanitized to ASCII equivalents for proper border alignment
- **Syntax highlighting** - Fixed Prism.js import order; `markup-templating` now loads before `php` and other dependent languages

### Added
- **Sandboxed page detection** - Shows warning "⚠ Sandboxed mode. Some features unavailable." on `raw.githubusercontent.com`
- Print button disabled on sandboxed pages (GitHub's CSP blocks `window.print()`)

### Technical
- Prism.js language imports reordered: `markup` → `clike` → `javascript` → `typescript/jsx/tsx` → `markup-templating` → `php`
- ASCII renderer: added `draw_back_edge()` function for cycle handling
- ASCII renderer: emoji sanitization converts to ASCII before width calculation

## [0.1.0] - 2025-12-15

### Added
- Initial release of MD browser extension
- **Markdown rendering** for raw `.md` URLs (GitHub, GitLab, Gitea, etc.)
- **Syntax highlighting** via Prism.js
- **Mermaid diagrams** support via API
- **ASCII diagrams** support via API
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
- Print disabled on sandboxed pages (`raw.githubusercontent.com`) due to CSP restrictions
- Use MD desktop app for local markdown files
