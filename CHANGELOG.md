# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2025-12-01

### Added
- Draft tabs: create untitled drafts with Ctrl+N, auto-numbered as Untitled-1, Untitled-2, etc.
- Toggleable line numbers in edit mode (Ctrl+L)
- Tab/Shift+Tab to indent/dedent single or multiple lines
- Wrap selection with quotes/brackets: select text and type ', ", `, (, [, {, <, *, _
- Replace existing wrapper by selecting wrapped text and typing a different wrapper character
- Undo/Redo support (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z)
- Quick access to files and drafts via Ctrl+1-9
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

### Fixed
- Line number drift on long documents
- Preserve draft content on Escape (revert to last saved state)
- Save current draft before creating new or switching files

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
