# Changelog

All notable changes to the MD browser extension will be documented in this file.

## [0.2.2] - 2025-12-19

### Fixed
- **Removed unused permissions** - Removed `scripting` permission and `host_permissions` that were declared but not used (flagged by Chrome Web Store review)

## [0.2.1] - 2025-12-17

### Fixed
- **Auto-render on repository UI pages** - No longer triggers on GitHub `/blob/`, GitLab `/-/blob/`, or Gitea `/src/branch/` URLs that show rendered HTML instead of raw markdown

## [0.2.0] - 2025-12-16

### Added
- **HTML to Markdown conversion**: Convert any webpage to markdown with one click
  - Uses Turndown for clean HTML-to-markdown conversion
  - Auto-removes scripts, nav, footer, and other non-content elements
  - Preserves article/main content when available
- **ASCII diagram support**: Render ASCII diagrams via API (flowchart, ERD, sequence, state, class, timeline, table)

### Fixed
- **CSS injection** - Extension styles no longer leak into non-markdown pages
- **ASCII diagrams with cycles** - Back-edges (e.g., `D --> A`) now render correctly with loopback arrows
- **ASCII table emoji alignment** - Unicode emoji (✅, ❌, etc.) sanitized to ASCII equivalents
- **Syntax highlighting** - Fixed Prism.js import order for PHP and dependent languages

### Changed
- Button styles now use shared theme from `@md/shared`
- Sandboxed page detection shows warning on `raw.githubusercontent.com`

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
