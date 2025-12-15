# MD - Markdown Ecosystem

Fast, lightweight Markdown viewer with live preview, edit mode, file watching, and theming.

**Stack:** Tauri 2 (Rust), SolidJS (NOT React), TypeScript, Vite, Bun, Shiki, MarkdownIt, Mermaid

**Flow:** `SolidJS UI → Tauri invoke() → Rust backend → File I/O`

**Decisions:** Desktop-first (Tauri) · Signals for state (SolidJS) · WASM for heavy lifting · Single instance

**Features:** Live preview · Edit mode · Mermaid diagrams · Theme-aware rendering · TOC panel · Print/PDF

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
│   └── extension/                # Chrome/Firefox extension
│       └── (Phase 1 - TODO)
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
| `Ctrl+G` | Table of contents |
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
1. Update `package.json` (root) → `version`
2. Update `packages/app/package.json` → `version`
3. Update `packages/app/src-tauri/Cargo.toml` → `version`
4. Update `packages/app/src-tauri/tauri.conf.json` → `version`
5. Update `CHANGELOG.md` with release notes
6. Git tag: `git tag vX.Y.Z`

**Patch vs Minor:**
- `fix/*` branch → patch (0.0.x) - bug fixes
- `feat/*` branch → minor (0.x.0) - new features

---

## Common Tasks

**Add Tauri command**: Function in `packages/app/src-tauri/src/lib.rs` with `#[tauri::command]` → register in `invoke_handler![]` → call via `invoke()`

**Add component**: File in `packages/app/src/components/` → import in parent → use SolidJS patterns (signals, Show, For)

**Modify state**: Edit `packages/app/src/stores/app-store.ts` → export signal + setter → use in components

**Add shared styles**: Edit files in `packages/shared/styles/` → import via `@md/shared/styles/*`

**Debug**: Check `~/.md/md.log` or run `make logs`

---

## Build & Release

**Platforms**: Linux (.deb, .rpm, .AppImage), macOS (.dmg), Windows (.msi, .exe)

**CI Workflows**:
- `ci.yml`: Tests + type check on PR
- `release.yml`: Build all platforms on GitHub release
