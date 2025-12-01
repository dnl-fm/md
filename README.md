<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" alt="MD Logo" width="128" height="128">
</p>

<h1 align="center">MD</h1>

<p align="center">
  A fast, lightweight Markdown preview application built with Tauri 2, SolidJS, and Shiki.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-blue" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

## Screenshots

<p align="center">
  <img src="docs/theme-dark.png" alt="Dark Theme" width="45%">
  &nbsp;&nbsp;
  <img src="docs/theme-light.png" alt="Light Theme" width="45%">
</p>

## Features

- **Live Preview** - Real-time markdown rendering with GitHub-flavored markdown support
- **Syntax Highlighting** - Code blocks with beautiful syntax highlighting powered by Shiki
- **Edit Mode** - Edit markdown directly in the app with toggleable line numbers
- **In-Document Search** - Find text with Ctrl+F, visual minimap for match locations
- **Draft Tabs** - Create untitled drafts with Ctrl+N, auto-numbered for easy access
- **Themes** - Dark and light themes with fully customizable colors
- **File Watching** - Automatic reload when the file changes externally
- **Recent Files** - Quick access to recently opened files with Ctrl+1-9
- **Customizable Fonts** - Choose font family and size for both UI and markdown content
- **Resizable Sidebar** - Drag to resize or double-click to auto-fit content
- **Lightweight** - Native performance with minimal resource usage

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open file |
| `Ctrl+N` | New untitled draft |
| `Ctrl+W` | Close file |
| `Ctrl+S` | Save changes (in edit mode) |
| `Ctrl+F` | Find in document |
| `Ctrl+L` | Toggle line numbers (in edit mode) |
| `Ctrl+T` | Toggle theme (dark/light) |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+,` | Open settings |
| `Ctrl++` | Increase font size |
| `Ctrl+-` | Decrease font size |
| `Ctrl+0` | Reset font size |
| `Ctrl+1-9` | Open Nth file/draft from sidebar |
| `Ctrl+Space` | Toggle edit mode |
| `Esc` | Cancel edit / close search / discard changes |

## Installation

### Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/dnl-fm/md/releases) page.

- **Linux**: `.deb`, `.rpm`, or `.AppImage`
- **macOS**: `.dmg`
- **Windows**: `.msi` or `.exe`

### Build from Source

#### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- [Bun](https://bun.sh/) (recommended) or npm

#### Build Steps

```bash
# Clone the repository
git clone https://github.com/dnl-fm/md.git
cd md

# Install dependencies
bun install

# Development mode
bun run dev

# Build for production
bun run build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Usage

### Open a file

- **From file manager**: Double-click any `.md` file or right-click → "Open with MD"
- **From app**: Launch MD and press `Ctrl+O` to select a file
- **From terminal**: `md /path/to/file.md` (if installed via .deb/.rpm)

### File Associations

MD registers itself for `.md` and `.markdown` files during installation.

### Settings

Click the ⚙ Settings button or press `Ctrl+,` to customize:

**Fonts Tab**
- UI Font Family and Size
- Markdown Font Family and Size

**Dark/Light Theme Tabs**
- Background colors
- Text colors  
- Accent colors
- Table colors
- Button colors

Settings are automatically saved and persisted.

## Configuration

Configuration is stored in:
- **Linux**: `~/.config/com.fightbulc.md-preview/config.json`
- **macOS**: `~/Library/Application Support/com.fightbulc.md-preview/config.json`
- **Windows**: `%APPDATA%\com.fightbulc.md-preview\config.json`

## Tech Stack

- **[Tauri 2](https://tauri.app/)** - Native app framework
- **[SolidJS](https://www.solidjs.com/)** - Reactive UI framework
- **[Shiki](https://shiki.matsu.io/)** - Syntax highlighting
- **[marked](https://marked.js.org/)** - Markdown parser
- **[Vite](https://vitejs.dev/)** - Build tool

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
