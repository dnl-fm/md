# MD - Markdown Preview Application

Fast, lightweight Markdown viewer with live preview, edit mode, file watching, and theming.

**Stack:** Tauri 2 (Rust), SolidJS (NOT React), TypeScript, Vite, Bun, Shiki, MarkdownIt

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

## Project Structure

```
md/
├── src/                          # Frontend (SolidJS/TypeScript)
│   ├── App.tsx                   # Main component, keyboard shortcuts
│   ├── index.tsx                 # Entry point
│   ├── types.ts                  # TypeScript interfaces
│   ├── utils.ts                  # Constants, helpers
│   ├── logger.ts                 # Frontend logging
│   ├── components/               # UI components
│   │   ├── sidebar.tsx           # Recent files, drafts
│   │   ├── file-header.tsx       # File info, actions
│   │   ├── markdown-viewer.tsx   # Preview + editor
│   │   ├── settings-modal.tsx    # Font & color settings
│   │   ├── confirm-dialog.tsx    # Reusable confirm dialog
│   │   ├── welcome-modal.tsx     # First-run onboarding
│   │   ├── help-modal.tsx        # Shortcuts + version
│   │   └── release-notification.tsx
│   ├── stores/
│   │   └── app-store.ts          # SolidJS signals (reactive state)
│   └── styles/
│       ├── theme.css             # CSS variables, layout
│       └── markdown.css          # Rendered markdown styles
│
├── src-tauri/                    # Backend (Rust/Tauri)
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   └── lib.rs                # All Tauri commands & config
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri config
│
├── src-wasm/                     # WASM module (Rust)
├── tests/                        # Unit tests (bun test)
└── docs/llm/                     # Detailed reference docs
```

---

## Documentation

Load from `docs/llm/` when task involves:

| Keywords | Load | Contents |
|----------|------|----------|
| state, signals, config, theme, CSS variables | [architecture.md](docs/llm/architecture.md) | State management, config, theming |
| invoke, commands, IPC, events, backend | [tauri-commands.md](docs/llm/tauri-commands.md) | All Tauri commands |
| patterns, print, PDF, quirks | [patterns.md](docs/llm/patterns.md) | Common code patterns |

Full index: [docs/llm/index.md](docs/llm/index.md)

---

## Development Commands

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

**⚠️ Before any commit:** Always run `make codequality` to ensure lint passes and tests succeed.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open file |
| `Ctrl+N` | New draft |
| `Ctrl+W` | Close file |
| `Ctrl+S` | Save (edit mode) |
| `Ctrl+Space` | Toggle edit mode |
| `Ctrl+F` | Search |
| `Ctrl+P` | Print/PDF |
| `Ctrl+T` | Toggle theme |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+,` | Settings |
| `Ctrl+H` | Help |
| `Ctrl++/-/0` | Font size |
| `Ctrl+1-9` | Open Nth file |
| `Ctrl+[/]` | Prev/next file |

---

## Versioning

When creating a new version:
1. Update `package.json` → `version`
2. Update `src-tauri/Cargo.toml` → `version`
3. Update `src-tauri/tauri.conf.json` → `version`
4. Update `CHANGELOG.md` with release notes
5. Git tag: `git tag vX.Y.Z`

**Patch vs Minor:**
- `fix/*` branch → patch (0.0.x) - bug fixes
- `feat/*` branch → minor (0.x.0) - new features

---

## Common Tasks

**Add Tauri command**: Function in `src-tauri/src/lib.rs` with `#[tauri::command]` → register in `invoke_handler![]` → call via `invoke()`

**Add component**: File in `src/components/` → import in parent → use SolidJS patterns (signals, Show, For)

**Modify state**: Edit `src/stores/app-store.ts` → export signal + setter → use in components

**Debug**: Check `~/.md/md.log` or run `make logs`

---

## Build & Release

**Platforms**: Linux (.deb, .rpm, .AppImage), macOS (.dmg), Windows (.msi, .exe)

**CI Workflows**:
- `ci.yml`: Tests + type check on PR
- `release.yml`: Build all platforms on GitHub release
