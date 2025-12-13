# Architecture & State Management

## Architecture Diagram

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
