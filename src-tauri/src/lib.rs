use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use chrono::Local;

const MAX_HISTORY: usize = 20;
const CONFIG_FILE: &str = "config.json";
const LOG_FILE: &str = "md.log";

// ============================================================================
// Logging
// ============================================================================

fn get_md_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|p| p.join(".md"))
}

fn get_log_path() -> Option<PathBuf> {
    get_md_dir().map(|p| p.join(LOG_FILE))
}

fn write_log(level: &str, message: &str) {
    if let Some(log_path) = get_log_path() {
        if let Some(parent) = log_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
            let _ = writeln!(file, "[{}] [{}] {}", timestamp, level, message);
        }
    }
}

#[tauri::command]
fn log_message(level: String, message: String) {
    write_log(&level, &message);
}

#[tauri::command]
fn get_log_path_cmd() -> Option<String> {
    get_log_path().and_then(|p| p.to_str().map(|s| s.to_string()))
}

// ============================================================================
// Config
// ============================================================================

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct ThemeColors {
    pub bg_primary: String,
    pub bg_secondary: String,
    pub bg_elevated: String,
    pub bg_code: String,
    pub bg_inline_code: String,
    #[serde(default)]
    pub bg_icon: String,
    pub text_primary: String,
    pub text_secondary: String,
    pub text_heading: String,
    pub text_link: String,
    pub border_color: String,
    pub code_border: String,
    pub accent_color: String,
    pub table_header_bg: String,
    pub table_row_odd: String,
    pub table_row_even: String,
    pub table_row_hover: String,
    #[serde(default)]
    pub btn_edit_active: String,
    #[serde(default)]
    pub btn_save: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub theme: String,
    pub history: VecDeque<String>,
    pub sidebar_collapsed: bool,
    #[serde(default = "default_sidebar_width")]
    pub sidebar_width: u32,
    #[serde(default = "default_font_size")]
    pub ui_font_size: u32,
    #[serde(default = "default_font_size")]
    pub markdown_font_size: u32,
    #[serde(default)]
    pub ui_font_family: Option<String>,
    #[serde(default)]
    pub markdown_font_family: Option<String>,
    #[serde(default)]
    pub dark_colors: Option<ThemeColors>,
    #[serde(default)]
    pub light_colors: Option<ThemeColors>,
    #[serde(default)]
    pub onboarding_complete: bool,
}

fn default_sidebar_width() -> u32 {
    220
}

fn default_font_size() -> u32 {
    14
}

impl AppConfig {
    fn config_path() -> Option<PathBuf> {
        dirs::home_dir().map(|p| p.join(".md").join(CONFIG_FILE))
    }

    pub fn load() -> Self {
        Self::config_path()
            .and_then(|p| fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| AppConfig {
                theme: "dark".to_string(),
                history: VecDeque::new(),
                sidebar_collapsed: true,
                sidebar_width: 220,
                ui_font_size: 14,
                markdown_font_size: 14,
                ui_font_family: None,
                markdown_font_family: None,
                dark_colors: None,
                light_colors: None,
                onboarding_complete: false,
            })
    }

    pub fn save(&self) {
        if let Some(path) = Self::config_path() {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if let Ok(json) = serde_json::to_string_pretty(self) {
                let _ = fs::write(path, json);
            }
        }
    }

    pub fn add_to_history(&mut self, path: &str) {
        self.history.retain(|p| p != path);
        self.history.push_front(path.to_string());
        while self.history.len() > MAX_HISTORY {
            self.history.pop_back();
        }
        self.save();
    }

    pub fn remove_from_history(&mut self, path: &str) {
        self.history.retain(|p| p != path);
        self.save();
    }
}

// ============================================================================
// App State
// ============================================================================

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub current_file: Mutex<Option<PathBuf>>,
    pub watcher: Mutex<Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            config: Mutex::new(AppConfig::load()),
            current_file: Mutex::new(None),
            watcher: Mutex::new(None),
        }
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
fn get_config(state: tauri::State<AppState>) -> AppConfig {
    state.config.lock().clone()
}

#[tauri::command]
fn save_config(state: tauri::State<AppState>, config: AppConfig) {
    let mut current = state.config.lock();
    *current = config;
    current.save();
}

#[tauri::command]
fn read_file(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct FileInfo {
    size: u64,
    modified: String,
}

#[tauri::command]
fn get_file_info(path: &str) -> Result<FileInfo, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let size = metadata.len();
    let modified = metadata
        .modified()
        .map_err(|e| e.to_string())?;
    let datetime: chrono::DateTime<chrono::Local> = modified.into();
    Ok(FileInfo {
        size,
        modified: datetime.format("%Y-%m-%d %H:%M").to_string(),
    })
}

#[tauri::command]
fn add_to_history(state: tauri::State<AppState>, path: &str) {
    state.config.lock().add_to_history(path);
}

#[tauri::command]
fn remove_from_history(state: tauri::State<AppState>, path: &str) {
    state.config.lock().remove_from_history(path);
}

#[tauri::command]
fn file_exists(path: &str) -> bool {
    std::path::Path::new(path).exists()
}

#[tauri::command]
fn watch_file(app: AppHandle, state: tauri::State<AppState>, path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    
    if !path_buf.exists() {
        return Err("File does not exist".to_string());
    }

    // Store current file
    *state.current_file.lock() = Some(path_buf.clone());

    // Stop existing watcher
    *state.watcher.lock() = None;

    // Create new watcher
    let app_clone = app.clone();
    let path_clone = path.clone();
    
    let mut debouncer = new_debouncer(
        Duration::from_millis(100),
        move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            if res.is_ok() {
                if let Ok(content) = fs::read_to_string(&path_clone) {
                    let _ = app_clone.emit("file-changed", content);
                }
            }
        },
    ).map_err(|e| e.to_string())?;

    // Watch the file
    debouncer
        .watcher()
        .watch(path_buf.as_ref(), RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    *state.watcher.lock() = Some(debouncer);

    Ok(())
}

#[tauri::command]
fn stop_watching(state: tauri::State<AppState>) {
    *state.watcher.lock() = None;
    *state.current_file.lock() = None;
}

/// Resolve a file path argument from CLI args.
/// Skips flags (args starting with '-') and returns canonicalized path if file exists.
fn resolve_file_arg<I, S>(args: I) -> Option<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter()
        .find(|arg| !arg.as_ref().starts_with('-'))
        .and_then(|path| {
            let p = PathBuf::from(path.as_ref());
            if p.exists() {
                p.canonicalize().ok()?.to_str().map(|s| s.to_string())
            } else {
                None
            }
        })
}

#[tauri::command]
fn get_initial_file() -> Option<String> {
    // Get CLI args - skip the first one (program name)
    resolve_file_arg(std::env::args().skip(1))
}

// ============================================================================
// Plugin Setup
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // When second instance is launched, this callback runs in the first instance
            // argv[0] is the program path, so skip it
            if let Some(path) = resolve_file_arg(argv.iter().skip(1)) {
                let _ = app.emit("open-file", path);
            }
            // Focus the main window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            read_file,
            write_file,
            get_file_info,
            add_to_history,
            remove_from_history,
            file_exists,
            watch_file,
            stop_watching,
            get_initial_file,
            log_message,
            get_log_path_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
