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

---

## Diagram Rendering

### Mermaid Diagrams

Mermaid diagrams are rendered with theme-aware colors derived from the app's theme.

**Implementation** (`src/mermaid-theme.ts` + `src/components/markdown-viewer.tsx`):
1. Theme colors extracted from `darkColors()` / `lightColors()` signals
2. Converted to Mermaid theme variables via `getMermaidThemeVariables()`
3. Diagrams rendered async with caching by content+theme
4. Placeholder with spinner shown while rendering
5. Height preserved to prevent layout shifts

**Theme mapping:**
- Background: `--bg-primary` → `primaryColor`, `secondaryColor`
- Text: `--text-primary` → `primaryTextColor`
- Lines/borders: `--border-color` → `lineColor`
- Accent: `--accent-color` → highlights

### ASCII Diagrams

ASCII diagrams use WASM module from `../../cli/ascii/` to render Mermaid-like syntax as box-drawing characters.

**Usage:**
````markdown
```ascii
flowchart TD
    A[Start] --> B[Process]
    B --> C{Decision?}
    C -->|Yes| D[End]
```
````

**Supported types:** flowchart, erDiagram, sequenceDiagram, stateDiagram, classDiagram, timeline, table

**Implementation** (`src/ascii-pkg/` + `src/components/markdown-viewer.tsx`):
1. WASM module built with `make build-ascii`
2. `render_ascii()` function called for `ascii` code blocks
3. Results cached by content
4. Rendered as `<pre class="ascii-diagram">` with monospace font

**When to use ASCII vs Mermaid:**
- **Mermaid:** Rich SVG graphics, hover states, complex layouts
- **ASCII:** Copy-pasteable, works in terminals/plain text, lightweight

---

## Table of Contents (TOC)

The page overview panel (`Ctrl+G`) shows a navigable table of contents.

**Implementation** (`src/components/page-overview-modal.tsx`):
- Extracts all h1-h6 headings from rendered content
- Calculates scroll positions for each heading
- Highlights current heading based on scroll position
- Click to navigate with smooth scroll + flash animation

**Feature flag:**
Page thumbnail previews are disabled (`ENABLE_PAGE_PREVIEWS = false`) due to scroll position mapping issues between PDF pagination and HTML content. The html2pdf.js + pdfjs-dist approach was tested but page positions didn't correlate accurately with the markdown scroll position.
