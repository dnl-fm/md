# Project Instructions

## Tech Stack (IMPORTANT)

- **Tauri 2** - Desktop app framework (Rust backend)
- **SolidJS** - Frontend framework (NOT React, NOT Svelte, NOT Vue)
- **TypeScript** - Language
- **Vite** - Build tool
- **Bun** - Package manager and test runner

SolidJS uses signals for reactivity (`createSignal`, `createEffect`, `Show`, `For`). Do NOT use React hooks or Svelte syntax.

## Reference

See [LLM.md](LLM.md) for comprehensive project documentation including architecture, state management, Tauri commands, theming, and common patterns.

## Versioning

When creating a new version:
- Update version in `src-tauri/tauri.conf.json`
- Update version in `src-tauri/Cargo.toml`
- Update version in `package.json`
- Update `CHANGELOG.md` with release notes
- Create git tag: `git tag vX.Y.Z`

### Patch vs Minor version
Use branch name as first indicator:
- `fix/*` branch → patch bump (0.0.x) - bug fixes, behavior improvements
- `feat/*` branch → minor bump (0.x.0) - new features, new functionality
