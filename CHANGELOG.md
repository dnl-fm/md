# Changelog

All notable changes to this project will be documented in this file.

## [0.9.0] - 2025-12-14

### Added
- **Mermaid diagrams**: Full support for flowcharts, sequence diagrams, class diagrams, and more
- **Theme-aware diagrams**: Diagrams automatically match your dark/light theme colors
- **Table of Contents**: Quick navigation panel (Ctrl+G) with current section highlighting
- **Live theme preview**: See color changes instantly in the settings modal
- **New shortcuts**: Ctrl+G (TOC), Ctrl+P (Print), Ctrl+H (Help), Ctrl+[/] (prev/next file)

### Changed
- Settings modal reorganized with tabbed UI/Markdown/Diagrams sections
- Table cells now consistently left-aligned
- Improved theme color organization with diagram-specific tokens

### Fixed
- Mermaid diagrams not rendering in production builds (externalized to avoid Vite bundling issues)

## [0.8.0] - 2025-12-13

### Added
- **Language-aware syntax highlighting**: Code blocks now have per-language highlighting for 16+ languages
  - SQL, JavaScript/TypeScript, PHP, Python, Rust, Go, Bash, JSON
  - HTML/XML/SVG, CSS/SCSS/SASS, YAML, TOML, C/C++, Java/Kotlin, Ruby, Docker
- **Editor ↔ Preview scroll sync**: Position preserved when switching modes
  - `data-line` attributes injected into rendered markdown
  - Editor API exposes `getTopVisibleLine()` for coordination
- **MarkdownIt integration**: Replaced marked with markdown-it for better extensibility

### Changed
- Markdown rendering now uses MarkdownIt with Shiki-based syntax highlighting
- Code fence language detection normalized to lowercase for consistent highlighting

## [0.7.0] - 2025-12-13

### Added
- **WASM-based editor**: New Rust/WebAssembly editor replacing textarea
  - Ropey-backed text buffer for O(log n) edits on large documents
  - Built-in markdown syntax highlighting (headings, code, bold, links, lists)
  - Virtual scrolling for performance with large files
  - Cursor and selection management in WASM
  - Undo/redo stacks managed in Rust
- History validation: Non-existent files automatically removed from sidebar on startup
- File existence check before loading (handles external file deletion)

### Changed
- Editor now uses `translate3d` + `will-change: transform` for virtual scroll (fixes WebView scrollbar bug)
- Keyboard shortcuts now case-insensitive
- Clipboard operations now have proper error handling

### Fixed
- Scrollbar disappearing during scroll in Tauri WebView (compositor bug workaround)
- Cursor missing after clicking into document
- Scrollbar drag not working (was intercepted by click handler)
- EOL cursor positioning in `line_col_to_offset`

## [0.6.0] - 2025-12-02

### Added
- Print / PDF export via Ctrl+P or "Print" button in file header
- Print-optimized stylesheet with proper page breaks and sizing
- Syntax highlighting preserved in PDF output
- Relative images automatically embedded as base64 (displayed in preview and PDF)
- New Tauri commands: `read_image_base64`, `get_file_dir`

## [0.5.0] - 2025-12-02

### Added
- JSDoc documentation across entire codebase
- Per-file undo/redo stacks (history preserved when switching files)
- Keyboard navigation in confirm dialog (Tab to switch buttons, Enter to activate)
- `normalizeMarkdown()` utility to convert LLM-generated en/em-dashes to list markers

### Changed
- Confirm dialog buttons now show custom labels ("Discard"/"Stay" instead of "OK"/"Cancel")
- Confirm button focused by default with visible focus outline

### Fixed
- LLM-generated lists with en-dash (–) or em-dash (—) now render correctly
- Prompt to save unsaved changes when switching files or creating new file
- Remove draft from sidebar when discarding unsaved changes
- Sync textarea content when switching files while in edit mode
- No false "unsaved changes" dialog after saving draft to file
- Refocus editor when clicking "Stay" in confirm dialog
- Line numbers performance: only update on Enter/Backspace/Delete, not every keystroke

## [0.4.0] - 2025-12-01

### Added
- Draft tabs: create untitled drafts with Ctrl+N, auto-numbered as Untitled-1, Untitled-2, etc.
- Toggleable line numbers in edit mode (Ctrl+L)
- Tab/Shift+Tab to indent/dedent single or multiple lines
- Wrap selection with quotes/brackets: select text and type ', ", `, (, [, {, <, *, _
- Replace existing wrapper by selecting wrapped text and typing a different wrapper character
- Undo/Redo support (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z)
- Quick access to files and drafts via Ctrl+1-9
- Ctrl+] and Ctrl+[ to cycle through open files/drafts (wraps around)
- Confirm dialog for destructive actions (closing unsaved drafts)
- Customizable draft and sidebar colors in theme settings
- Release notification toast on app startup when new version is available
- Help modal (Ctrl+H) with keyboard shortcuts and version info
- View Changelog button in help modal (loads bundled CHANGELOG.md)

### Changed
- Settings modal now groups colors by category (UI/Markdown sub-tabs)
- Improved edit mode with uncontrolled textarea for better undo support
- Keyboard shortcuts moved from Settings to Help modal
- Sidebar minimum width increased to 300px
- Ctrl++/-/0 now changes both UI and markdown font sizes together
- Opening help closes settings and vice versa (no modal stacking)

### Fixed
- Line number drift on long documents
- Preserve draft content on Escape (revert to last saved state)
- Save current draft before creating new or switching files
- File header height now matches sidebar header (both 48px)

## [0.3.0] - 2025-11-28

### Added
- In-document search with Ctrl+F
- Search highlights matches in yellow, current match in orange
- Navigate matches with Enter/Shift+Enter or arrow buttons
- Minimap on right edge shows match positions in document
- Click minimap markers to jump to specific match
- LLM.md reference documentation for codebase

## [0.2.1] - 2025-11-28

### Added
- Single-instance support: opening a file reuses existing window instead of launching new instance

## [0.2.0] - 2025-11-27

### Added
- Welcome modal for first-time users
- Demo markdown file for showcasing MD features
- Logging to `~/.md/md.log` for debugging
- Ctrl+W shortcut to close window
- Customizable button colors for Edit and Save buttons
- Tabbed settings modal
- Dark and light theme screenshots to README

### Fixed
- Spacing for headers following tables and code blocks
- Cmd+S shortcut for macOS in edit mode
- Multiple file dialogs opening on Ctrl+O key repeat
- Theme toggle not syncing with splash screen styles
- CSP for Shiki syntax highlighting (wasm-unsafe-eval)

## [0.1.0] - 2025-11-27

### Added
- Initial release
- Markdown rendering with syntax highlighting
- Light and dark themes
- Edit mode with live preview
- File open/save functionality
- Keyboard shortcuts
