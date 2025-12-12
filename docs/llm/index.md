# LLM Documentation Index

Detailed reference documentation for the MD markdown preview application.

## Available Documents

| Document | Description |
|----------|-------------|
| [architecture.md](architecture.md) | App architecture, state management, config, theming |
| [tauri-commands.md](tauri-commands.md) | All Tauri IPC commands and events |
| [patterns.md](patterns.md) | Common code patterns, print/PDF, quirks |

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main component, keyboard shortcuts, file loading |
| `src/stores/app-store.ts` | All reactive state (signals) |
| `src/types.ts` | TypeScript interfaces |
| `src/utils.ts` | Constants, helper functions |
| `src-tauri/src/lib.rs` | All Rust logic: config, commands, file watcher |

### Dependencies

**Frontend:**
- `@tauri-apps/api` - Tauri JS bindings
- `@tauri-apps/plugin-*` - File dialog, filesystem, opener
- `solid-js` - Reactive UI framework
- `marked` - Markdown parser
- `shiki` - Syntax highlighter

**Backend:**
- `tauri` + plugins - App framework
- `serde` / `serde_json` - Serialization
- `notify-debouncer-mini` - File watching
- `dirs` - Platform config paths
- `parking_lot` - Mutex
- `chrono` - Date/time
