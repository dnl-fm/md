import { createSignal, createEffect, onMount, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Marked } from "marked";
import { createHighlighter, type Highlighter } from "shiki";

import "./styles/theme.css";
import "./styles/markdown.css";
import {
  type ThemeColors,
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  FONT_OPTIONS,
  getFontFamilyCSS,
  getFilename,
  formatFileSize,
  escapeHtml,
  slugify,
  clamp,
  calculateSidebarWidth,
} from "./utils";

interface AppConfig {
  theme: string;
  history: string[];
  sidebar_collapsed: boolean;
  sidebar_width?: number;
  ui_font_size?: number;
  markdown_font_size?: number;
  ui_font_family?: string;
  markdown_font_family?: string;
  dark_colors?: ThemeColors;
  light_colors?: ThemeColors;
}

interface FileInfo {
  size: number;
  modified: string;
}

// Initialize marked
const marked = new Marked();

// App Component
function App() {
  const [config, setConfig] = createSignal<AppConfig>({
    theme: "dark",
    history: [],
    sidebar_collapsed: false,
  });
  const [currentFile, setCurrentFile] = createSignal<string | null>(null);
  const [content, setContent] = createSignal<string>("");
  const [originalContent, setOriginalContent] = createSignal<string>("");
  const [renderedHtml, setRenderedHtml] = createSignal<string>("");
  const isDirty = () => showRawMarkdown() && content() !== originalContent();
  const [highlighter, setHighlighter] = createSignal<Highlighter | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
  const [sidebarWidth, setSidebarWidth] = createSignal(220);
  const [isResizing, setIsResizing] = createSignal(false);
  const [uiFontSize, setUiFontSize] = createSignal(14);
  const [markdownFontSize, setMarkdownFontSize] = createSignal(14);
  const [uiFontFamily, setUiFontFamily] = createSignal("system");
  const [markdownFontFamily, setMarkdownFontFamily] =
    createSignal("JetBrains Mono");
  const [fileInfo, setFileInfo] = createSignal<FileInfo | null>(null);
  const [showSettings, setShowSettings] = createSignal(false);
  const [showRawMarkdown, setShowRawMarkdown] = createSignal(false);
  const [darkColors, setDarkColors] = createSignal<ThemeColors>({
    ...DEFAULT_DARK_COLORS,
  });
  const [lightColors, setLightColors] = createSignal<ThemeColors>({
    ...DEFAULT_LIGHT_COLORS,
  });

  // Apply theme colors to CSS variables
  function applyThemeColors() {
    const colors = config().theme === "dark" ? darkColors() : lightColors();
    const root = document.documentElement;
    root.style.setProperty("--bg-primary", colors.bg_primary);
    root.style.setProperty("--bg-secondary", colors.bg_secondary);
    root.style.setProperty("--bg-elevated", colors.bg_elevated);
    root.style.setProperty("--bg-code", colors.bg_code);
    root.style.setProperty("--bg-inline-code", colors.bg_inline_code);
    root.style.setProperty("--bg-icon", colors.bg_icon);
    root.style.setProperty("--text-primary", colors.text_primary);
    root.style.setProperty("--text-secondary", colors.text_secondary);
    root.style.setProperty("--text-heading", colors.text_heading);
    root.style.setProperty("--text-link", colors.text_link);
    root.style.setProperty("--border-color", colors.border_color);
    root.style.setProperty("--code-border", colors.code_border);
    root.style.setProperty("--accent-color", colors.accent_color);
    root.style.setProperty("--table-header-bg", colors.table_header_bg);
    root.style.setProperty("--table-row-odd", colors.table_row_odd);
    root.style.setProperty("--table-row-even", colors.table_row_even);
    root.style.setProperty("--table-row-hover", colors.table_row_hover);
  }

  // Initialize highlighter
  onMount(async () => {
    const hl = await createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: [
        "javascript",
        "typescript",
        "python",
        "rust",
        "go",
        "java",
        "c",
        "cpp",
        "csharp",
        "php",
        "ruby",
        "swift",
        "kotlin",
        "sql",
        "html",
        "css",
        "json",
        "yaml",
        "toml",
        "markdown",
        "bash",
        "shell",
        "dockerfile",
        "plaintext",
      ],
    });
    setHighlighter(hl);

    // Load config
    const cfg = await invoke<AppConfig>("get_config");
    setConfig(cfg);
    setSidebarCollapsed(cfg.sidebar_collapsed);
    setSidebarWidth(cfg.sidebar_width || 220);
    setUiFontSize(cfg.ui_font_size || 14);
    setMarkdownFontSize(cfg.markdown_font_size || 14);
    setUiFontFamily(cfg.ui_font_family || "system");
    setMarkdownFontFamily(cfg.markdown_font_family || "JetBrains Mono");
    setDarkColors(cfg.dark_colors || { ...DEFAULT_DARK_COLORS });
    setLightColors(cfg.light_colors || { ...DEFAULT_LIGHT_COLORS });
    document.documentElement.setAttribute("data-theme", cfg.theme);
    applyThemeColors();

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeyDown);

    // Check for initial file from CLI first
    const initialFile = await invoke<string | null>("get_initial_file");
    if (initialFile) {
      await loadFile(initialFile);
    } else if (cfg.history.length > 0) {
      // Try to load most recent file
      await loadMostRecentFile(cfg.history);
    }

    // Listen for file changes
    await listen<string>("file-changed", (event) => {
      setContent(event.payload);
      setOriginalContent(event.payload);
    });
  });

  // Load most recent file that exists
  async function loadMostRecentFile(history: string[]) {
    for (const path of history) {
      try {
        const exists = await invoke<boolean>("file_exists", { path });
        if (exists) {
          await loadFile(path, false);
          return;
        } else {
          // Remove non-existent file from history
          await invoke("remove_from_history", { path });
        }
      } catch {
        // Remove problematic file from history
        await invoke("remove_from_history", { path });
      }
    }
    // Refresh config after cleanup
    const cfg = await invoke<AppConfig>("get_config");
    setConfig(cfg);
  }

  // Keyboard shortcut handler
  async function handleKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case "o":
          e.preventDefault();
          openFileDialog();
          break;
        case "t":
          e.preventDefault();
          toggleTheme();
          break;
        case "b":
          e.preventDefault();
          toggleSidebar();
          break;
        case ",":
          e.preventDefault();
          setShowSettings(!showSettings());
          break;
        case "=":
        case "+":
          e.preventDefault();
          changeMarkdownFontSize(1);
          break;
        case "-":
          e.preventDefault();
          changeMarkdownFontSize(-1);
          break;
        case "0":
          e.preventDefault();
          changeMarkdownFontSize(0);
          break;
        case " ":
          e.preventDefault();
          setShowRawMarkdown(!showRawMarkdown());
          break;
        case "e":
          e.preventDefault();
          if (!isDirty()) {
            setShowRawMarkdown(!showRawMarkdown());
          }
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          e.preventDefault();
          const index = parseInt(e.key) - 1;
          const history = config().history;
          if (index < history.length) {
            loadFile(history[index], false);
          }
          break;
      }
    }
    if (e.key === "Escape") {
      if (showSettings()) {
        setShowSettings(false);
      } else if (showRawMarkdown()) {
        setContent(originalContent());
        setShowRawMarkdown(false);
      }
    }
  }

  // Save file and return to preview
  async function saveAndPreview() {
    const file = currentFile();
    if (file && isDirty()) {
      await invoke("write_file", { path: file, content: content() });
      setOriginalContent(content());
    }
    setShowRawMarkdown(false);
  }

  // Change markdown font size
  async function changeMarkdownFontSize(delta: number) {
    const newSize =
      delta === 0 ? 14 : clamp(markdownFontSize() + delta, 10, 24);
    setMarkdownFontSize(newSize);
    const newConfig = { ...config(), markdown_font_size: newSize };
    setConfig(newConfig);
    await invoke("save_config", { config: newConfig });
  }

  // Render markdown when content or highlighter changes
  createEffect(async () => {
    const md = content();
    const hl = highlighter();

    if (!md) {
      setRenderedHtml("");
      return;
    }

    const theme = config().theme === "dark" ? "github-dark" : "github-light";

    marked.setOptions({
      gfm: true,
      breaks: false,
    });

    const renderer = {
      code({ text, lang }: { text: string; lang?: string }): string {
        const language = lang || "plaintext";
        if (hl) {
          try {
            const highlighted = hl.codeToHtml(text, { lang: language, theme });
            return `<div class="code-block-wrapper">${lang ? `<span class="code-block-lang">${lang}</span>` : ""}${highlighted}</div>`;
          } catch {
            return `<pre><code>${escapeHtml(text)}</code></pre>`;
          }
        }
        return `<pre><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
      },
      heading({
        tokens,
        depth,
      }: {
        tokens: { raw: string }[];
        depth: number;
      }): string {
        const text = tokens.map((t) => t.raw).join("");
        const slug = slugify(text);
        return `<h${depth} id="${slug}">${text}</h${depth}>`;
      },
    };

    marked.use({ renderer });

    const html = await marked.parse(md);
    setRenderedHtml(html);
  });

  // Load a file
  async function loadFile(path: string, addToHistory: boolean = true) {
    try {
      const fileContent = await invoke<string>("read_file", { path });
      setContent(fileContent);
      setOriginalContent(fileContent);
      setCurrentFile(path);

      const info = await invoke<FileInfo>("get_file_info", { path });
      setFileInfo(info);

      if (addToHistory && !config().history.includes(path)) {
        await invoke("add_to_history", { path });
        const cfg = await invoke<AppConfig>("get_config");
        setConfig(cfg);
      }

      await invoke("watch_file", { path });
    } catch (e) {
      console.error("Failed to load file:", e);
    }
  }

  // Open file dialog
  async function openFileDialog() {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Markdown", extensions: ["md", "markdown", "mkd"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (selected) {
      await loadFile(selected);
    }
  }

  // Toggle theme
  async function toggleTheme() {
    const newTheme = config().theme === "dark" ? "light" : "dark";
    const newConfig = { ...config(), theme: newTheme };
    setConfig(newConfig);
    document.documentElement.setAttribute("data-theme", newTheme);
    applyThemeColors();
    await invoke("save_config", { config: newConfig });
  }

  // Toggle sidebar
  async function toggleSidebar() {
    const collapsed = !sidebarCollapsed();
    setSidebarCollapsed(collapsed);
    const newConfig = { ...config(), sidebar_collapsed: collapsed };
    setConfig(newConfig);
    await invoke("save_config", { config: newConfig });
  }

  // Sidebar resize handlers
  function startResize(e: MouseEvent) {
    e.preventDefault();
    setIsResizing(true);
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", stopResize);
  }

  function handleResize(e: MouseEvent) {
    if (!isResizing()) return;
    setSidebarWidth(clamp(e.clientX, 150, 500));
  }

  async function stopResize() {
    if (!isResizing()) return;
    setIsResizing(false);
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);
    const newConfig = { ...config(), sidebar_width: sidebarWidth() };
    setConfig(newConfig);
    await invoke("save_config", { config: newConfig });
  }

  // Auto-resize sidebar to fit content
  async function autoResizeSidebar() {
    const history = config().history;
    if (history.length === 0) return;

    const estimatedWidth = calculateSidebarWidth(history);
    setSidebarWidth(estimatedWidth);
    const newConfig = { ...config(), sidebar_width: estimatedWidth };
    setConfig(newConfig);
    await invoke("save_config", { config: newConfig });
  }

  // Save settings
  async function saveSettings() {
    const newConfig = {
      ...config(),
      ui_font_size: uiFontSize(),
      markdown_font_size: markdownFontSize(),
      ui_font_family: uiFontFamily(),
      markdown_font_family: markdownFontFamily(),
      dark_colors: darkColors(),
      light_colors: lightColors(),
    };
    setConfig(newConfig);
    applyThemeColors();
    await invoke("save_config", { config: newConfig });
  }

  // Update color
  async function updateColor(
    theme: "dark" | "light",
    key: keyof ThemeColors,
    value: string,
  ) {
    if (theme === "dark") {
      setDarkColors({ ...darkColors(), [key]: value });
    } else {
      setLightColors({ ...lightColors(), [key]: value });
    }
    applyThemeColors();
    await saveSettings();
  }

  // Reset colors to defaults
  async function resetColors(theme: "dark" | "light") {
    if (theme === "dark") {
      setDarkColors({ ...DEFAULT_DARK_COLORS });
    } else {
      setLightColors({ ...DEFAULT_LIGHT_COLORS });
    }
    applyThemeColors();
    await saveSettings();
  }

  // Color labels for display
  const colorLabels: Record<keyof ThemeColors, string> = {
    bg_primary: "Background",
    bg_secondary: "Sidebar Background",
    bg_elevated: "Elevated Background",
    bg_code: "Code Block Background",
    bg_inline_code: "Inline Code Background",
    bg_icon: "Icon Background",
    text_primary: "Text",
    text_secondary: "Secondary Text",
    text_heading: "Headings",
    text_link: "Links",
    border_color: "Borders",
    code_border: "Code Border",
    accent_color: "Accent",
    table_header_bg: "Table Header",
    table_row_odd: "Table Odd Row",
    table_row_even: "Table Even Row",
    table_row_hover: "Table Row Hover",
  };

  return (
    <div
      class={`app-container ${isResizing() ? "resizing" : ""}`}
      style={{
        "font-size": `${uiFontSize()}px`,
        "font-family": getFontFamilyCSS(uiFontFamily()),
      }}
    >
      {/* Sidebar */}
      <aside
        class={`sidebar ${sidebarCollapsed() ? "collapsed" : ""}`}
        style={{ width: sidebarCollapsed() ? "48px" : `${sidebarWidth()}px` }}
      >
        <div class="sidebar-header">
          <button
            class="btn btn-icon"
            onClick={toggleSidebar}
            title={sidebarCollapsed() ? "Expand (Ctrl+B)" : "Collapse (Ctrl+B)"}
          >
            {sidebarCollapsed() ? "☰" : "✕"}
          </button>
        </div>

        <Show when={!sidebarCollapsed()}>
          <div class="sidebar-content">
            <button class="btn btn-full" onClick={openFileDialog}>
              📂 Open File
            </button>

            <div class="history-section">
              <div class="history-title">Recent Files</div>
              <For each={config().history}>
                {(path) => (
                  <div
                    class={`history-item ${currentFile() === path ? "active" : ""}`}
                    onClick={() => loadFile(path, false)}
                    title={path}
                  >
                    📄 {getFilename(path)}
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Collapsed sidebar buttons */}
        <Show when={sidebarCollapsed()}>
          <div class="sidebar-collapsed-buttons">
            <button
              class="btn btn-icon"
              onClick={openFileDialog}
              title="Open file (Ctrl+O)"
            >
              📂
            </button>
            <div class="recent-buttons">
              <For each={config().history.slice(0, 9)}>
                {(path, index) => (
                  <button
                    class={`btn btn-icon ${currentFile() === path ? "active" : ""}`}
                    onClick={() => loadFile(path, false)}
                    title={`${path} (Ctrl+${index() + 1})`}
                  >
                    {index() + 1}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Footer with theme and settings - always at bottom */}
        <div class="sidebar-footer">
          <Show when={!sidebarCollapsed()}>
            <div class="sidebar-footer-left">
              <button
                class="btn"
                onClick={toggleTheme}
                title="Toggle theme (Ctrl+T)"
              >
                {config().theme === "dark" ? "☀ Light" : "🌙 Dark"}
              </button>
            </div>
            <button
              class="btn"
              onClick={() => setShowSettings(true)}
              title="Settings (Ctrl+,)"
            >
              ⚙ Settings
            </button>
          </Show>

          <Show when={sidebarCollapsed()}>
            <button
              class="btn btn-icon"
              onClick={toggleTheme}
              title="Toggle theme (Ctrl+T)"
            >
              {config().theme === "dark" ? "☀" : "🌙"}
            </button>
            <button
              class="btn btn-icon"
              onClick={() => setShowSettings(true)}
              title="Settings (Ctrl+,)"
            >
              ⚙
            </button>
          </Show>
        </div>

        <Show when={!sidebarCollapsed()}>
          <div
            class="sidebar-resize-handle"
            onMouseDown={startResize}
            onDblClick={autoResizeSidebar}
          />
        </Show>
      </aside>

      {/* Main Content */}
      <main class="main-content">
        <Show when={currentFile()}>
          <div class="file-header">
            <span class="file-path">📄 {currentFile()}</span>
            <div class="file-header-right">
              <Show when={isDirty()}>
                <button
                  class="btn btn-small"
                  onClick={() => {
                    setContent(originalContent());
                    setShowRawMarkdown(false);
                  }}
                  title="Discard changes (Esc)"
                >
                  Cancel
                </button>
              </Show>
              <button
                class={`btn btn-small ${showRawMarkdown() ? "active" : ""} ${isDirty() ? "btn-dirty" : ""}`}
                onClick={() => {
                  if (showRawMarkdown()) {
                    saveAndPreview();
                  } else {
                    setShowRawMarkdown(true);
                  }
                }}
                title={showRawMarkdown() ? (isDirty() ? "Save changes (Ctrl+S)" : "Back to preview (Esc)") : "Edit markdown (Ctrl+Space)"}
              >
                {showRawMarkdown() ? (isDirty() ? "Save" : "Preview") : "Edit"}
              </button>
              <Show when={fileInfo()}>
                <span class="file-meta">
                  {formatFileSize(fileInfo()!.size)} · {fileInfo()!.modified}
                </span>
              </Show>
            </div>
          </div>
        </Show>

        <div class="markdown-container">
          <Show
            when={content()}
            fallback={
              <div class="empty-state">
                <div class="empty-state-icon">📄</div>
                <div class="empty-state-title">No file open</div>
                <div class="empty-state-text">
                  Open a Markdown file from the sidebar or press Ctrl+O
                </div>
              </div>
            }
          >
            <Show when={showRawMarkdown()}>
              <textarea
                class="markdown-raw markdown-editor"
                style={{
                  "font-size": `${markdownFontSize()}px`,
                  "font-family": getFontFamilyCSS(markdownFontFamily()),
                }}
                value={content()}
                onInput={(e) => setContent(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.ctrlKey && e.key === "s") {
                    e.preventDefault();
                    saveAndPreview();
                  }
                }}
                spellcheck={false}
              />
            </Show>
            <Show when={!showRawMarkdown()}>
              <article
                class="markdown-content markdown-body"
                innerHTML={renderedHtml()}
                style={{
                  "font-size": `${markdownFontSize()}px`,
                  "font-family": getFontFamilyCSS(markdownFontFamily()),
                }}
              />
            </Show>
          </Show>
        </div>
      </main>

      {/* Settings Modal */}
      <Show when={showSettings()}>
        <div class="modal-overlay" onClick={() => setShowSettings(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>Settings</h2>
              <button
                class="btn btn-icon"
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>

            <div class="modal-content">
              {/* Font Settings */}
              <div class="settings-section">
                <h3>Fonts</h3>
                <div class="settings-row">
                  <label>UI Font Family</label>
                  <select
                    class="settings-select"
                    value={uiFontFamily()}
                    onChange={(e) => {
                      setUiFontFamily(e.currentTarget.value);
                      saveSettings();
                    }}
                  >
                    <For each={FONT_OPTIONS}>
                      {(opt) => <option value={opt.value}>{opt.label}</option>}
                    </For>
                  </select>
                </div>
                <div class="settings-row">
                  <label>UI Font Size</label>
                  <div class="settings-control">
                    <button
                      class="btn btn-icon"
                      onClick={() => {
                        setUiFontSize(Math.max(10, uiFontSize() - 1));
                        saveSettings();
                      }}
                    >
                      −
                    </button>
                    <span class="font-size-value">{uiFontSize()}px</span>
                    <button
                      class="btn btn-icon"
                      onClick={() => {
                        setUiFontSize(Math.min(20, uiFontSize() + 1));
                        saveSettings();
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div class="settings-row">
                  <label>Markdown Font Family</label>
                  <select
                    class="settings-select"
                    value={markdownFontFamily()}
                    onChange={(e) => {
                      setMarkdownFontFamily(e.currentTarget.value);
                      saveSettings();
                    }}
                  >
                    <For each={FONT_OPTIONS}>
                      {(opt) => <option value={opt.value}>{opt.label}</option>}
                    </For>
                  </select>
                </div>
                <div class="settings-row">
                  <label>Markdown Font Size</label>
                  <div class="settings-control">
                    <button
                      class="btn btn-icon"
                      onClick={() => {
                        setMarkdownFontSize(
                          Math.max(10, markdownFontSize() - 1),
                        );
                        saveSettings();
                      }}
                    >
                      −
                    </button>
                    <span class="font-size-value">{markdownFontSize()}px</span>
                    <button
                      class="btn btn-icon"
                      onClick={() => {
                        setMarkdownFontSize(
                          Math.min(24, markdownFontSize() + 1),
                        );
                        saveSettings();
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Theme Colors */}
              <div class="settings-section">
                <div class="settings-section-header">
                  <h3>Dark Theme Colors</h3>
                  <button
                    class="btn btn-small"
                    onClick={() => resetColors("dark")}
                  >
                    Reset
                  </button>
                </div>
                <div class="color-grid">
                  <For each={Object.entries(colorLabels)}>
                    {([key, label]) => (
                      <div class="color-item">
                        <label>{label}</label>
                        <input
                          type="color"
                          value={darkColors()[key as keyof ThemeColors]}
                          onInput={(e) =>
                            updateColor(
                              "dark",
                              key as keyof ThemeColors,
                              e.currentTarget.value,
                            )
                          }
                        />
                      </div>
                    )}
                  </For>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-header">
                  <h3>Light Theme Colors</h3>
                  <button
                    class="btn btn-small"
                    onClick={() => resetColors("light")}
                  >
                    Reset
                  </button>
                </div>
                <div class="color-grid">
                  <For each={Object.entries(colorLabels)}>
                    {([key, label]) => (
                      <div class="color-item">
                        <label>{label}</label>
                        <input
                          type="color"
                          value={lightColors()[key as keyof ThemeColors]}
                          onInput={(e) =>
                            updateColor(
                              "light",
                              key as keyof ThemeColors,
                              e.currentTarget.value,
                            )
                          }
                        />
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Keyboard Shortcuts */}
              <div class="settings-section">
                <h3>Keyboard Shortcuts</h3>
                <div class="shortcuts-list">
                  <div class="shortcut">
                    <kbd>Ctrl+O</kbd> Open file
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+T</kbd> Toggle theme
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+B</kbd> Toggle sidebar
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+,</kbd> Settings
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl++</kbd> Increase font
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+-</kbd> Decrease font
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+0</kbd> Reset font
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+Space</kbd> Toggle raw
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default App;
