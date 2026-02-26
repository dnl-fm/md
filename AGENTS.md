# MD - Markdown Ecosystem

Desktop app + browser extension for viewing markdown files beautifully.

**Stack:** Tauri 2 (Rust), SolidJS (NOT React), TypeScript, Vite, Bun, Shiki, MarkdownIt, Mermaid, ASCII (WASM)

**Architecture:** Bun workspace monorepo with shared styles across packages

**Flow:** `SolidJS UI → Tauri invoke() → Rust backend → File I/O`

**Decisions:** Desktop-first (Tauri) · Signals for state (SolidJS) · WASM for heavy lifting · Single instance

---

## ⚠️ SolidJS (NOT React)

SolidJS uses signals for reactivity. Do NOT use React hooks or patterns.

```typescript
// ✅ SolidJS
import { createSignal, createEffect, Show, For } from "solid-js";
const [count, setCount] = createSignal(0);

// ❌ NOT React
import { useState, useEffect } from "react";  // WRONG
```

---

## Monorepo Structure

Bun workspaces with `packages/*`. Single `bun install` at root installs all dependencies.

```
md/
├── packages/
│   ├── shared/                   # Shared code across packages
│   │   ├── package.json
│   │   └── styles/
│   │       ├── theme.css         # CSS variables, colors
│   │       ├── markdown.css      # Rendered markdown styles
│   │       └── print.css         # Print styles
│   │
│   ├── app/                      # Tauri desktop app
│   │   ├── package.json
│   │   ├── src/                  # SolidJS frontend
│   │   │   ├── App.tsx           # Main component, shortcuts
│   │   │   ├── index.tsx         # Entry point
│   │   │   ├── types.ts          # TypeScript interfaces
│   │   │   ├── utils.ts          # Constants, helpers
│   │   │   ├── logger.ts         # Frontend logging
│   │   │   ├── components/       # UI components
│   │   │   ├── stores/           # SolidJS signals
│   │   │   └── styles/           # App-specific styles
│   │   ├── src-tauri/            # Rust backend
│   │   │   ├── src/lib.rs        # Tauri commands
│   │   │   ├── Cargo.toml        # Rust deps
│   │   │   └── tauri.conf.json   # Tauri config
│   │   ├── src-wasm/             # WASM module (Rust)
│   │   └── tests/                # Unit tests
│   │
│   ├── extension/                # Chrome/Firefox extension
│   │   ├── package.json
│   │   ├── manifest.json         # Extension manifest v3
│   │   ├── build.ts              # Bundle script
│   │   ├── src/
│   │   │   ├── content.ts        # Main content script
│   │   │   ├── detector.ts       # URL pattern detection
│   │   │   ├── toc.ts            # Table of contents
│   │   │   └── extension.css     # Styles
│   │   ├── icons/                # Extension icons
│   │   └── dist/                 # Built extension
│   │
│   └── api/                      # Rendering API server
│       ├── cmd/server/           # Go server entry
│       ├── internal/
│       │   ├── handlers/         # HTTP handlers
│       │   └── renderer/         # Mermaid renderer (chromedp)
│       ├── Dockerfile            # Docker build
│       └── bin/ascii             # ASCII CLI (not in git)
│
├── package.json                  # Workspace root
├── Makefile                      # Dev commands
├── docs/
│   ├── llm/                      # LLM reference docs
│   └── plans/                    # Project plans
└── README.md
```

**Workspace imports:**
```typescript
import "@md/shared/styles/theme.css";
import "@md/shared/styles/markdown.css";
```

---

## Components

| Component | Status | Purpose |
|-----------|--------|---------|
| **MD App** | ✅ Complete | Desktop app: local files, full editing, print/PDF |
| **MD Extension** | ✅ Phase 1 | Browser extension: raw .md URL rendering |
| **MD API** | ✅ Complete | Server-side rendering for Mermaid/ASCII diagrams |
| **MD Cloud** | 📋 Planned | Document storage, sharing, revision history |

---

## Extension Architecture

**No remote code loading.** Everything is bundled. Diagrams rendered via API (returns SVG/text, not code).

| Feature | Approach | Why |
|---------|----------|-----|
| Markdown parsing | markdown-it (bundled) | Fast, extensible |
| Syntax highlighting | Prism.js (bundled) | Small (~200KB total) |
| Mermaid diagrams | API (`/render/mermaid/`) | Returns SVG |
| ASCII diagrams | API (`/render/ascii/`) | Returns text |
| HTML→Markdown | Turndown (bundled) | Reader mode |

**Chrome Web Store:**
- **ID:** `heagnonehdabjameokpjkbneplkkiifp`
- **URL:** https://chromewebstore.google.com/detail/md/heagnonehdabjameokpjkbneplkkiifp

**API Stack:** Go + Chi router + chromedp (headless Chrome) + Nginx

**Server:** `94.130.18.211` (api.getmd.dev)

**Deployment:**
```bash
# ASCII binary in Docker container
ssh root@94.130.18.211 "docker cp /path/to/ascii md-api:/usr/local/bin/ascii"
ssh root@94.130.18.211 "docker restart md-api"
```

**Sandboxed pages:** `raw.githubusercontent.com` sends `sandbox` CSP header, blocking:
- `window.print()` - Print disabled, warning shown
- `window.open()` - Popups blocked

---

## Documentation

Load from `docs/llm/` when task involves:

| Keywords | Load | Contents |
|----------|------|----------|
| state, signals, config, theme, CSS variables | [architecture.md](docs/llm/architecture.md) | State management, config, theming |
| invoke, commands, IPC, events, backend | [tauri-commands.md](docs/llm/tauri-commands.md) | All Tauri commands |
| patterns, print, PDF, quirks | [patterns.md](docs/llm/patterns.md) | Common code patterns |
| ecosystem, extension, cloud, phases | [plans/md-ecosystem.md](docs/plans/md-ecosystem.md) | Full ecosystem plan |

Full index: [docs/llm/index.md](docs/llm/index.md)

---

## Development Commands

### Desktop App

```bash
make dev           # Start dev server + Tauri
make build         # Production build (wasm + tauri)
make build-wasm    # Build WASM module only
make test          # Run tests
make test-watch    # Watch mode tests
make codequality   # Run typecheck, lint, and tests
make logs          # Tail ~/.md/md.log
make version       # Show versions across files
```

### Extension

```bash
cd packages/extension
bun run build      # Build extension to dist/
bun run watch      # Watch mode

# Load in Chrome:
# 1. chrome://extensions
# 2. Enable Developer mode
# 3. Load unpacked → packages/extension/dist
```

**⚠️ Before any commit:** Always run `make codequality` to ensure lint passes and tests succeed.

---

## Keyboard Shortcuts

### Desktop App

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open file |
| `Ctrl+N` | New draft |
| `Ctrl+W` | Close file |
| `Ctrl+S` | Save (edit mode) |
| `Ctrl+Space` | Toggle edit mode |
| `Ctrl+F` | Search |
| `Ctrl+G` | Table of contents |
| `Ctrl+P` | Print/PDF |
| `Ctrl+T` | Toggle theme |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+,` | Settings |
| `Ctrl+H` | Help |
| `Ctrl++/-/0` | Font size |
| `Ctrl+1-9` | Open Nth file |
| `Ctrl+[/]` | Prev/next file |

### Extension

| Shortcut | Action |
|----------|--------|
| `M` | Reader mode (convert page to markdown) |
| `Ctrl+G` | Table of contents |
| `Ctrl+T` | Toggle theme |
| `Ctrl+P` | Print / PDF |
| `Ctrl++/-/0` | Font size |
| `Ctrl+H` | Help |

**Settings:** Stored in `chrome.storage.local` (persists across all URLs).

> **No `file://` support:** Extension works on remote URLs only. Use MD app for local files.

---

## AI Chat (Desktop App)

Built-in Claude integration for document analysis and Q&A.

### Commands

Type `/` in the input field to show command menu. Navigate with arrow keys, select with Enter.

| Command | Description |
|---------|-------------|
| `/clear` | Reset conversation history |
| `/summarise` | Generate comprehensive document summary |
| `/model` | Select AI model (opens submenu) |
| `/export` | Export chat as markdown in new tab |

### Command Menu Pattern

Commands are defined in `ai-chat-panel.tsx`:

```typescript
interface Command {
  name: string;           // Command name (without /)
  description: string;    // Shown in menu
  hasSubmenu?: boolean;   // Opens nested selection
  action?: () => void;    // Direct execution
}
```

**Menu behavior:**
- Shows when input starts with `/`
- Filters as user types more characters
- Arrow keys navigate, Tab autocompletes, Enter executes, Escape closes
- Commands with `hasSubmenu: true` open a nested selection (e.g., model picker)

### Models

Available via `/model` command:

| Short Name | Full Name | API ID |
|------------|-----------|--------|
| haiku-4.5 | Claude Haiku 4.5 | `claude-haiku-4-5` |
| sonnet-4.5 | Claude Sonnet 4.5 | `claude-sonnet-4-5` |
| opus-4.5 | Claude Opus 4.5 | `claude-opus-4-5` |

**State:** Model selection persisted in localStorage (`md-ai-model`).

---

## Versioning

When creating a new version:
1. Update `package.json` (root) → `version`
2. Update `packages/app/package.json` → `version`
3. Update `packages/app/src-tauri/Cargo.toml` → `version`
4. Update `packages/app/src-tauri/tauri.conf.json` → `version`
5. Update `CHANGELOG.md` with release notes
6. Git tag: `git tag vX.Y.Z`

**Patch vs Minor:**
- `fix/*` branch → patch (0.0.x) - bug fixes
- `feat/*` branch → minor (0.x.0) - new features

**Changelogs:** Each package has its own changelog:
- `packages/app/CHANGELOG.md` - Desktop app
- `packages/extension/CHANGELOG.md` - Browser extension  
- `packages/shared/CHANGELOG.md` - Shared styles

---

## Common Tasks

**Add Tauri command**: Function in `packages/app/src-tauri/src/lib.rs` with `#[tauri::command]` → register in `invoke_handler![]` → call via `invoke()`

**Add component**: File in `packages/app/src/components/` → import in parent → use SolidJS patterns (signals, Show, For)

**Modify state**: Edit `packages/app/src/stores/app-store.ts` → export signal + setter → use in components

**Add shared styles**: Edit files in `packages/shared/styles/` → import via `@md/shared/styles/*`

**Debug**: Check `~/.md/md.log` or run `make logs`

---

## Gotchas

### Tauri Resource Paths

Resources with `../` prefix in `tauri.conf.json` are bundled under `_up_/` directory:

```json
// tauri.conf.json
"resources": ["../CHANGELOG.md"]
```

```rust
// In Rust, access as:
let resource_path = resource_dir.join("_up_/CHANGELOG.md");  // ✅ Correct
let resource_path = resource_dir.join("CHANGELOG.md");       // ❌ Won't find it
```

### Extension Auto-Publish

Chrome Web Store upload fails while extension is pending review. Workflow in `.github/workflows/extension-release.yml` has auto-publish commented out. Re-enable after approval.

### Extension Versioning

Update version in 3 places:
1. `packages/extension/package.json`
2. `packages/extension/manifest.json`
3. `packages/extension/src/content.ts` (VERSION constant)

---

## Build & Release

**Platforms**: Linux (.deb, .rpm, .AppImage), macOS (.dmg), Windows (.msi, .exe)

**CI Workflows**:
- `ci.yml`: Tests + type check on PR
- `release.yml`: Build all platforms on GitHub release
