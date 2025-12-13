# Tauri Commands (IPC)

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

## Adding a New Tauri Command

1. Add function in `src-tauri/src/lib.rs` with `#[tauri::command]`
2. Register in `invoke_handler![]` macro
3. Call from frontend: `await invoke("command_name", { params })`
