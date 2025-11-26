# Marky

A fast, lightweight Markdown preview application built with Tauri 2, SolidJS, and Shiki.

![Marky Screenshot](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Live Preview** - Real-time markdown rendering with GitHub-flavored markdown support
- **Syntax Highlighting** - Code blocks with beautiful syntax highlighting powered by Shiki
- **Themes** - Dark and light themes with fully customizable colors
- **File Watching** - Automatic reload when the file changes externally
- **Recent Files** - Quick access to recently opened files
- **Raw Mode** - Toggle between rendered preview and raw markdown
- **Customizable Fonts** - Choose font family and size for both UI and markdown content
- **Resizable Sidebar** - Drag to resize or double-click to auto-fit content
- **Lightweight** - Native performance with minimal resource usage

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open file |
| `Ctrl+T` | Toggle theme (dark/light) |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+,` | Open settings |
| `Ctrl++` | Increase font size |
| `Ctrl+-` | Decrease font size |
| `Ctrl+0` | Reset font size |
| `Ctrl+Space` | Toggle raw markdown |

## Installation

### Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/dnl-fm/marky/releases) page.

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
git clone https://github.com/dnl-fm/marky.git
cd marky

# Install dependencies
bun install

# Development mode
bun run tauri dev

# Build for production
bun run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Usage

### Open a file

```bash
# Open Marky with a file
./marky /path/to/file.md

# Or just open Marky and use Ctrl+O to select a file
./marky
```

### Settings

Click the ⚙ Settings button or press `Ctrl+,` to customize:

- **UI Font Family** - Font for the application interface
- **UI Font Size** - Size of UI elements (10-20px)
- **Markdown Font Family** - Font for markdown content
- **Markdown Font Size** - Size of markdown text (10-24px)
- **Theme Colors** - Customize all colors for both dark and light themes

Settings are automatically saved and persisted.

## Configuration

Configuration is stored in:
- **Linux**: `~/.config/md-preview/md-preview-v2.json`
- **macOS**: `~/Library/Application Support/md-preview/md-preview-v2.json`
- **Windows**: `%APPDATA%\md-preview\md-preview-v2.json`

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
