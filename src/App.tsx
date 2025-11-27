import { createEffect, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Marked } from "marked";
import { createHighlighter, type Highlighter } from "shiki";

import "./styles/theme.css";
import "./styles/markdown.css";

import type { AppConfig, FileInfo } from "./types";
import {
  config,
  setConfig,
  setDarkColors,
  setLightColors,
  applyThemeColors,
  toggleTheme,
  currentFile,
  setCurrentFile,
  content,
  setContent,
  originalContent,
  setOriginalContent,
  setRenderedHtml,
  setFileInfo,
  isDirty,
  sidebarCollapsed,
  setSidebarCollapsed,
  setSidebarWidth,
  isResizing,
  uiFontSize,
  setUiFontSize,
  markdownFontSize,
  setMarkdownFontSize,
  uiFontFamily,
  setUiFontFamily,
  setMarkdownFontFamily,
  showSettings,
  setShowSettings,
  showRawMarkdown,
  setShowRawMarkdown,
} from "./stores/app-store";
import {
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  getFontFamilyCSS,
  escapeHtml,
  slugify,
  clamp,
} from "./utils";

import { Sidebar } from "./components/sidebar";
import { FileHeader } from "./components/file-header";
import { MarkdownViewer } from "./components/markdown-viewer";
import { SettingsModal } from "./components/settings-modal";

// Initialize marked
const marked = new Marked();

// Highlighter instance (module-level for effects)
let highlighter: Highlighter | null = null;

function App() {
  // Initialize highlighter and config
  onMount(async () => {
    highlighter = await createHighlighter({
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

    // Load config
    const cfg = await invoke<AppConfig>("get_config");
    setConfig(cfg);
    setSidebarCollapsed(cfg.sidebar_collapsed);
    setSidebarWidth(cfg.sidebar_width || 220);
    setUiFontSize(cfg.ui_font_size || 14);
    setMarkdownFontSize(cfg.markdown_font_size || 14);
    setUiFontFamily(cfg.ui_font_family || "system");
    setMarkdownFontFamily(cfg.markdown_font_family || "JetBrains Mono");
    setDarkColors({ ...DEFAULT_DARK_COLORS, ...cfg.dark_colors });
    setLightColors({ ...DEFAULT_LIGHT_COLORS, ...cfg.light_colors });
    document.documentElement.setAttribute("data-theme", cfg.theme);
    // Sync light class with theme for index.html styles
    if (cfg.theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    localStorage.setItem("theme", cfg.theme);
    applyThemeColors();

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeyDown);

    // Check for initial file from CLI first
    const initialFile = await invoke<string | null>("get_initial_file");
    if (initialFile) {
      await loadFile(initialFile);
    } else if (cfg.history.length > 0) {
      await loadMostRecentFile(cfg.history);
    }

    // Listen for file changes
    await listen<string>("file-changed", (event) => {
      setContent(event.payload);
      setOriginalContent(event.payload);
    });

    // Hide splash screen now that app is ready
    (window as any).hideSplash?.();
  });

  // Render markdown when content changes
  createEffect(async () => {
    const md = content();

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
        if (highlighter) {
          try {
            const highlighted = highlighter.codeToHtml(text, { lang: language, theme });
            return `<div class="code-block-wrapper">${lang ? `<span class="code-block-lang">${lang}</span>` : ""}${highlighted}</div>`;
          } catch {
            return `<pre><code>${escapeHtml(text)}</code></pre>`;
          }
        }
        return `<pre><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
      },
      heading({ tokens, depth }: { tokens: { raw: string }[]; depth: number }): string {
        const text = tokens.map((t) => t.raw).join("");
        const slug = slugify(text);
        return `<h${depth} id="${slug}">${text}</h${depth}>`;
      },
    };

    marked.use({ renderer });

    const html = await marked.parse(md);
    setRenderedHtml(html);
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
          await invoke("remove_from_history", { path });
        }
      } catch {
        await invoke("remove_from_history", { path });
      }
    }
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

  // Toggle sidebar
  async function toggleSidebar() {
    const collapsed = !sidebarCollapsed();
    setSidebarCollapsed(collapsed);
    const newConfig = { ...config(), sidebar_collapsed: collapsed };
    setConfig(newConfig);
    await invoke("save_config", { config: newConfig });
  }

  // Change markdown font size
  async function changeMarkdownFontSize(delta: number) {
    const newSize = delta === 0 ? 14 : clamp(markdownFontSize() + delta, 10, 24);
    setMarkdownFontSize(newSize);
    const newConfig = { ...config(), markdown_font_size: newSize };
    setConfig(newConfig);
    await invoke("save_config", { config: newConfig });
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

  return (
    <div
      class={`app-container ${isResizing() ? "resizing" : ""}`}
      style={{
        "font-size": `${uiFontSize()}px`,
        "font-family": getFontFamilyCSS(uiFontFamily()),
      }}
    >
      <Sidebar onOpenFile={openFileDialog} onLoadFile={loadFile} />

      <main class="main-content">
        <FileHeader onSaveAndPreview={saveAndPreview} />
        <MarkdownViewer onSaveAndPreview={saveAndPreview} />
      </main>

      <SettingsModal />
    </div>
  );
}

export default App;
