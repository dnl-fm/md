# MD - Markdown Preview Application

> LLM Reference Documentation for understanding, debugging, and extending this codebase.

## Overview

**MD** is a cross-platform desktop Markdown preview application built with:
- **Tauri 2** (Rust backend + native webview)
- **SolidJS** (reactive TypeScript frontend)
- **Shiki** (syntax highlighting)
- **marked** (Markdown parsing)

**Purpose**: Fast, lightweight Markdown viewer with live preview, edit mode, file watching, and theming.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Tauri Window                            │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (SolidJS + TypeScript)                               │
│  ┌──────────────┐  ┌────────────────────────────────────────┐  │
│  │   Sidebar    │  │           Main Content                 │  │
│  │ - Recent     │  │ ┌────────────────────────────────────┐ │  │
│  │   files      │  │ │ FileHeader (filename, actions)     │ │  │
│  │ - Open btn   │  │ ├────────────────────────────────────┤ │  │
│  │              │  │ │ MarkdownViewer                     │ │  │
│  │              │  │ │ - Rendered HTML (preview mode)     │ │  │
│  │              │  │ │ - Raw textarea (edit mode)         │ │  │
│  │              │  │ └────────────────────────────────────┘ │  │
│  └──────────────┘  └────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Backend (Rust via Tauri)                                       │
│  - File I/O (read/write)                                        │
│  - File watching (notify-debouncer-mini)                        │
│  - Config persistence (~/.md/config.json)                       │
│  - Logging (~/.md/md.log)                                       │
│  - Single instance handling                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```text
md/
├── src/                          # Frontend (SolidJS/TypeScript)
│   ├── App.tsx                   # Main application component
│   ├── index.tsx                 # Entry point, renders App
│   ├── types.ts                  # TypeScript interfaces
│   ├── utils.ts                  # Utility functions, default colors
│   ├── logger.ts                 # Frontend logging (calls Rust backend)
│   ├── components/
│   │   ├── sidebar.tsx           # Recent files, drafts, open button
│   │   ├── file-header.tsx       # Current file info, edit/save buttons
│   │   ├── markdown-viewer.tsx   # Rendered markdown or raw editor with line numbers
│   │   ├── settings-modal.tsx    # Font & color customization (UI/Markdown sub-tabs)
│   │   ├── confirm-dialog.tsx    # Reusable centered confirm dialog
│   │   ├── welcome-modal.tsx     # First-run onboarding
│   │   ├── help-modal.tsx        # Help with shortcuts and version info
│   │   ├── release-notification.tsx # New version toast notification
│   │   └── empty-state.tsx       # No file open state
│   ├── stores/
│   │   └── app-store.ts          # SolidJS signals (reactive state)
│   └── styles/
│       ├── theme.css             # CSS variables, layout, components
│       └── markdown.css          # Rendered markdown styles
│
├── src-tauri/                    # Backend (Rust/Tauri)
│   ├── src/
│   │   ├── main.rs               # Entry point (calls lib.rs)
│   │   └── lib.rs                # All Tauri commands & config logic
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri config (window, bundle, etc.)
│   ├── icons/                    # App icons
│   └── build.rs                  # Tauri build script
│
├── tests/
│   └── utils.test.ts             # Unit tests (bun test)
│
├── index.html                    # HTML shell with splash screen
├── vite.config.ts                # Vite bundler config
├── package.json                  # Frontend deps & npm scripts
├── tsconfig.json                 # TypeScript config
└── .github/workflows/
    ├── ci.yml                    # PR tests + type check
    └── release.yml               # Build releases for all platforms
```

---

## Key Files Reference

### Frontend

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main component: initializes highlighter, loads config, handles keyboard shortcuts, orchestrates file loading |
| `src/stores/app-store.ts` | All reactive state (signals): config, current file, content, theme colors, UI state |
| `src/types.ts` | TypeScript interfaces: `AppConfig`, `ThemeColors`, `FileInfo` |
| `src/utils.ts` | Constants (`DEFAULT_DARK_COLORS`, `DEFAULT_LIGHT_COLORS`), helper functions |
| `src/components/sidebar.tsx` | Collapsible sidebar with file history, resizable |
| `src/components/settings-modal.tsx` | Settings UI: fonts, theme colors (UI/Markdown sub-tabs) |
| `src/components/confirm-dialog.tsx` | Reusable confirm dialog with `confirm()` function |
| `src/components/help-modal.tsx` | Help modal with keyboard shortcuts and version info |
| `src/components/release-notification.tsx` | Toast notification for new releases |

### Backend

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | All Rust logic: config management, Tauri commands, file watcher |
| `src-tauri/tauri.conf.json` | App identity, window config, CSP, bundle settings |
| `src-tauri/Cargo.toml` | Rust dependencies |

---

## State Management

State uses **SolidJS signals** in `src/stores/app-store.ts`:

```typescript
// Core state signals
config()              // AppConfig: theme, history, settings
currentFile()         // string | null: path of open file
content()             // string: current markdown content
originalContent()     // string: content at load (for dirty check)
renderedHtml()        // string: HTML output from marked

// UI state signals
sidebarCollapsed()    // boolean
showSettings()        // boolean
showHelp()            // boolean: help modal visible
showRawMarkdown()     // boolean: edit mode toggle
isReadOnly()          // boolean: current file is read-only (e.g., bundled changelog)
showLineNumbers()     // boolean: line numbers in edit mode
showSearch()          // boolean: search bar visible
searchQuery()         // string: current search term
isDirty()             // derived: content !== originalContent

// Draft state
drafts()              // Draft[]: in-memory unsaved files
currentDraftId()      // string | null: active draft ID
```

---

## Tauri Commands (IPC)

Frontend calls Rust via `invoke()`:

| Command | Parameters | Returns | Purpose |
|---------|------------|---------|---------|
| `get_config` | - | `AppConfig` | Load persisted config |
| `save_config` | `config: AppConfig` | - | Persist config to disk |
| `read_file` | `path: string` | `string` | Read file contents |
| `write_file` | `path, content` | - | Write file to disk |
| `get_file_info` | `path: string` | `FileInfo` | Get size, modified date |
| `watch_file` | `path: string` | - | Start watching for changes |
| `stop_watching` | - | - | Stop file watcher |
| `add_to_history` | `path: string` | - | Add file to recent history |
| `remove_from_history` | `path: string` | - | Remove from history |
| `file_exists` | `path: string` | `boolean` | Check if file exists |
| `get_initial_file` | - | `string \| null` | Get CLI-provided file path |
| `log_message` | `level, message` | - | Write to log file |
| `get_app_version` | - | `string` | Get app version from Cargo.toml |
| `get_changelog_path` | - | `string` | Get path to bundled CHANGELOG.md |
| `read_image_base64` | `path: string` | `string` | Read image as base64 data URI |
| `get_file_dir` | `path: string` | `string \| null` | Get parent directory of file |

---

## Events (Backend → Frontend)

| Event | Payload | Trigger |
|-------|---------|---------|
| `file-changed` | `string` (content) | File modified externally |
| `open-file` | `string` (path) | Second instance launched with file arg |

---

## Configuration

**Location**: `~/.md/config.json`

```typescript
interface AppConfig {
  theme: "dark" | "light";
  history: string[];           // Recent file paths (max 20)
  sidebar_collapsed: boolean;
  sidebar_width: number;       // Default: 220
  ui_font_size: number;        // Default: 14
  markdown_font_size: number;  // Default: 14
  ui_font_family: string;
  markdown_font_family: string;
  dark_colors?: ThemeColors;   // Custom theme overrides
  light_colors?: ThemeColors;
  onboarding_complete: boolean;
  last_seen_version?: string;  // Tracks which release notification user has seen
}
```

---

## Theming System

1. **CSS Variables** defined in `src/styles/theme.css`
2. **Default colors** in `src/utils.ts` (`DEFAULT_DARK_COLORS`, `DEFAULT_LIGHT_COLORS`)
3. **Runtime application** via `applyThemeColors()` in `app-store.ts`
4. **Persistence** in config's `dark_colors` / `light_colors` fields

Key CSS variables:
- `--bg-primary`, `--bg-secondary`, `--bg-elevated`, `--bg-code`
- `--text-primary`, `--text-secondary`, `--text-heading`, `--text-link`
- `--border-color`, `--accent-color`
- `--table-*` for table styling
- `--btn-*` for button colors
- `--draft-*` for draft styling
- `--sidebar-active-bg` for active sidebar item

---

## Print / PDF Export

Press `Ctrl+P` or click the "Print" button in the file header to export the current document as PDF.

**Features:**
- Uses browser's native print-to-PDF functionality
- Optimized print stylesheet (`src/styles/print.css`)
- Preserves syntax highlighting colors in code blocks
- Automatically converts relative image paths to embedded base64
- Tables and code blocks wrap to fit page width

**Print CSS settings:**
- Page: A4 with 1.5cm margins
- Body text: 8pt
- Headings: h1=13pt, h2=11pt, h3=10pt, h4=9pt
- Code blocks: 6.5pt with syntax highlighting
- Tables: 7pt with word wrapping
- Language labels: 6pt

---

## Keyboard Shortcuts

| Shortcut | Action | Handler in |
|----------|--------|------------|
| `Ctrl+O` | Open file dialog | `App.tsx` |
| `Ctrl+N` | New untitled draft | `App.tsx` |
| `Ctrl+W` | Close current file | `App.tsx` |
| `Ctrl+S` | Save (in edit mode) | Triggers save flow |
| `Ctrl+Z` | Undo (edit mode) | `markdown-viewer.tsx` |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo (edit mode) | `markdown-viewer.tsx` |
| `Ctrl+F` | Toggle search bar | `setShowSearch()` |
| `Ctrl+L` | Toggle line numbers (edit mode) | `setShowLineNumbers()` |
| `Ctrl+P` | Print / Export PDF | `printDocument()` |
| `Ctrl+T` | Toggle theme | `toggleTheme()` |
| `Ctrl+B` | Toggle sidebar | `toggleSidebar()` |
| `Ctrl+,` | Open settings | `setShowSettings()` |
| `Ctrl+H` | Open help | `setShowHelp()` |
| `Ctrl++/-/0` | Font size (UI + markdown) | `changeFontSize()` |
| `Ctrl+Space` | Toggle edit mode | `setShowRawMarkdown()` |
| `Ctrl+1-9` | Open Nth file/draft | Quick access |
| `Ctrl+]` | Next file/draft | Cycle with wrap |
| `Ctrl+[` | Previous file/draft | Cycle with wrap |
| `Tab` | Indent line(s) (edit mode) | `markdown-viewer.tsx` |
| `Shift+Tab` | Dedent line(s) (edit mode) | `markdown-viewer.tsx` |
| Wrap chars (`'`, `## "`, `` ` ``, etc.) | Wrap/replace selection | `markdown-viewer.tsx` |
| `Esc` | Cancel edit / close modal / search | Various |

---

## Release Notifications

On app startup, if `config.last_seen_version` differs from the current app version (and onboarding is complete), a toast notification appears in the lower-right corner:

- Shows "New Release X.Y.Z" with a "View Changelog" button
- Clicking "View Changelog" loads the bundled `CHANGELOG.md` as a read-only file
- Dismissing (X button or viewing changelog) saves `last_seen_version` to config
- The changelog is added to recent files like any normal file but cannot be edited

---

## Development Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server + Tauri
bun run build        # Production build
bun test             # Run tests
bun run test:watch   # Watch mode tests
```

---

## Build & Release

**Platforms**: Linux (.deb, .rpm, .AppImage), macOS (.dmg), Windows (.msi, .exe)

**CI Workflows**:
- `ci.yml`: Tests + type check on PR
- `release.yml`: Build all platforms on GitHub release

**Version bump checklist**:
1. `package.json` → `version`
2. `src-tauri/Cargo.toml` → `version`
3. `src-tauri/tauri.conf.json` → `version`
4. `CHANGELOG.md` → release notes
5. Git tag: `git tag vX.Y.Z`

---

## Common Patterns

### Loading a file
```typescript
// In App.tsx
async function loadFile(path: string) {
  const content = await invoke<string>("read_file", { path });
  setContent(content);
  setOriginalContent(content);
  setCurrentFile(path);
  await invoke("watch_file", { path });
}
```

### Saving config changes
```typescript
// In app-store.ts
async function saveSettings() {
  const newConfig = { ...config(), ui_font_size: uiFontSize() };
  setConfig(newConfig);
  await invoke("save_config", { config: newConfig });
}
```

### Adding a new Tauri command
1. Add function in `src-tauri/src/lib.rs` with `#[tauri::command]`
2. Register in `invoke_handler![]` macro
3. Call from frontend: `await invoke("command_name", { params })`

### Using the confirm dialog
```typescript
import { confirm } from "./components/confirm-dialog";

// Simple usage
const confirmed = await confirm("Are you sure?", "Confirm Action");

// With custom button labels
const shouldDiscard = await confirm(
  "You have unsaved changes that will be lost.",
  {
    title: "Unsaved Changes",
    confirmLabel: "Discard",
    cancelLabel: "Stay",
  }
);
```

### Normalizing LLM markdown
```typescript
import { normalizeMarkdown } from "./utils";

// Converts LLM-generated en-dash (–) and em-dash (—) list markers to hyphens
const normalized = normalizeMarkdown(rawMarkdown);
// "– Item" becomes "- Item"
```

---

## Dependencies

### Frontend (package.json)
- `@tauri-apps/api` - Tauri JS bindings
- `@tauri-apps/plugin-*` - File dialog, filesystem, opener
- `solid-js` - Reactive UI framework
- `marked` - Markdown parser
- `shiki` - Syntax highlighter

### Backend (Cargo.toml)
- `tauri` + plugins - App framework
- `serde` / `serde_json` - Serialization
- `notify-debouncer-mini` - File watching
- `dirs` - Platform config paths
- `parking_lot` - Mutex
- `chrono` - Date/time

---

## Debugging

**Log file**: `~/.md/md.log`

**Frontend logging**:
```typescript
import { logger } from "./logger";
logger.info("message");
logger.error("error");
```

**View logs**:
```bash
tail -f ~/.md/md.log
```

---

## Known Quirks

1. **Single instance**: Uses `tauri-plugin-single-instance` - second launch passes file to first instance
2. **File watcher debounce**: 100ms delay to prevent rapid-fire updates
3. **Shiki initialization**: Async highlighter setup, renders without highlighting until ready
4. **Splash screen**: CSS-based in `index.html`, hidden via `window.hideSplash()`
