# Changelog

All notable changes to this project will be documented in this file.

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
