# Common Patterns

## Loading a File

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

## Saving Config Changes

```typescript
// In app-store.ts
async function saveSettings() {
  const newConfig = { ...config(), ui_font_size: uiFontSize() };
  setConfig(newConfig);
  await invoke("save_config", { config: newConfig });
}
```

## Using the Confirm Dialog

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

## Normalizing LLM Markdown

```typescript
import { normalizeMarkdown } from "./utils";

// Converts LLM-generated en-dash (–) and em-dash (—) list markers to hyphens
const normalized = normalizeMarkdown(rawMarkdown);
// "– Item" becomes "- Item"
```

---

## Print / PDF Export

Press `Ctrl+P` or click the "Print" button in the file header to export the current document as PDF.

**Features:**
- Uses browser's native print-to-PDF functionality
- Optimized print stylesheet (`src/styles/print.css`)
- Preserves syntax highlighting colors in code blocks
- Relative images are embedded as base64 during markdown rendering (works in preview and PDF)
- Tables and code blocks wrap to fit page width

**Print CSS settings:**
- Page: A4 with 1.5cm margins
- Body text: 8pt
- Headings: h1=13pt, h2=11pt, h3=10pt, h4=9pt
- Code blocks: 6.5pt with syntax highlighting
- Tables: 7pt with word wrapping
- Language labels: 6pt

---

## Release Notifications

On app startup, if `config.last_seen_version` differs from the current app version (and onboarding is complete), a toast notification appears in the lower-right corner:

- Shows "New Release X.Y.Z" with a "View Changelog" button
- Clicking "View Changelog" loads the bundled `CHANGELOG.md` as a read-only file
- Dismissing (X button or viewing changelog) saves `last_seen_version` to config
- The changelog is added to recent files like any normal file but cannot be edited

---

## Known Quirks

1. **Single instance**: Uses `tauri-plugin-single-instance` - second launch passes file to first instance
2. **File watcher debounce**: 100ms delay to prevent rapid-fire updates
3. **Shiki initialization**: Async highlighter setup, renders without highlighting until ready
4. **Splash screen**: CSS-based in `index.html`, hidden via `window.hideSplash()`
5. **Mermaid caching**: SVGs cached by content+theme hash for instant theme switching

---

## Feature Flags

### Page Previews (DISABLED)

**Flag:** `ENABLE_PAGE_PREVIEWS` in `src/components/page-overview-modal.tsx`

**Status:** `false` - Only TOC is shown in the page overview panel.

**Background:** Attempted to generate page thumbnails using:
1. `html2canvas` / `modern-screenshot` - Too slow (~170ms/page), blocked UI
2. `html2pdf.js` + `pdfjs-dist` - Fast (~32ms/page) but scroll positions don't match

**Issue:** PDF pagination reflows content differently than HTML. Clicking a page thumbnail scrolled to the wrong position in the markdown. The PDF's page breaks don't correlate with the original HTML scroll positions.

**Future fix options:**
- Use DOM-based capture with better yielding
- Accept approximate positions
- Calculate positions from PDF metadata

## Sandboxed Pages (Extension)

GitHub's `raw.githubusercontent.com` serves files with restrictive CSP headers:

```
content-security-policy: default-src 'none'; style-src 'unsafe-inline'; sandbox
```

The `sandbox` directive disables:
- `allow-scripts` - no JavaScript execution in page context
- `allow-modals` - no `window.print()`, `alert()`, etc.
- `allow-popups` - no `window.open()`

**Extension behavior on sandboxed pages:**
- Detects via `window.location.hostname === 'raw.githubusercontent.com'`
- Shows warning: "⚠ Sandboxed mode. Some features unavailable."
- Print button visible but disabled
- Ctrl+P shortcut disabled

**Why extension still works:**
- Content scripts run in isolated world, not affected by page CSP
- Can still manipulate DOM, fetch APIs, etc.
- Only blocked: features that require page-level permissions (print, popups)

## ASCII Diagram Cycles

Flowcharts can have back-edges (cycles) like `D --> A` where target is above source.

**Problem:** Original code assumed `to_top_y > from_bottom_y`, causing overflow.

**Solution:** `draw_back_edge()` function routes connector:
1. Right from source box
2. Up along right side
3. Left into target with `◄` arrow

```
┌─────────┐   
│  Start  │◄─┐
└─────────┘  │
     │       │
     ▼       │
┌─────────┐  │
│   End   │──┘
└─────────┘
```

## Prism.js Language Dependencies

Languages must be imported in dependency order:

```typescript
// Core (no deps)
await import("prismjs/components/prism-markup");
await import("prismjs/components/prism-css");
await import("prismjs/components/prism-clike");

// Depends on clike
await import("prismjs/components/prism-javascript");

// Depends on javascript
await import("prismjs/components/prism-typescript");
await import("prismjs/components/prism-jsx");
await import("prismjs/components/prism-tsx");

// Templating (depends on markup)
await import("prismjs/components/prism-markup-templating");

// Depends on markup-templating
await import("prismjs/components/prism-php");
```

**Error if wrong order:** `Cannot read properties of undefined (reading 'tokenizePlaceholders')`
