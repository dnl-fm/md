import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, FileInfo, ThemeColors } from "../types";
import { DEFAULT_DARK_COLORS, DEFAULT_LIGHT_COLORS } from "../utils";

// Config and theme
const [config, setConfig] = createSignal<AppConfig>({
  theme: "dark",
  history: [],
  sidebar_collapsed: false,
});
const [darkColors, setDarkColors] = createSignal<ThemeColors>({ ...DEFAULT_DARK_COLORS });
const [lightColors, setLightColors] = createSignal<ThemeColors>({ ...DEFAULT_LIGHT_COLORS });

// File state
const [currentFile, setCurrentFile] = createSignal<string | null>(null);
const [content, setContent] = createSignal<string>("");
const [originalContent, setOriginalContent] = createSignal<string>("");
const [renderedHtml, setRenderedHtml] = createSignal<string>("");
const [fileInfo, setFileInfo] = createSignal<FileInfo | null>(null);

// UI state
const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
const [sidebarWidth, setSidebarWidth] = createSignal(220);
const [isResizing, setIsResizing] = createSignal(false);
const [uiFontSize, setUiFontSize] = createSignal(14);
const [markdownFontSize, setMarkdownFontSize] = createSignal(14);
const [uiFontFamily, setUiFontFamily] = createSignal("system");
const [markdownFontFamily, setMarkdownFontFamily] = createSignal("JetBrains Mono");
const [showSettings, setShowSettings] = createSignal(false);
const [showRawMarkdown, setShowRawMarkdown] = createSignal(false);

// Derived state
const isDirty = () => showRawMarkdown() && content() !== originalContent();

// Apply theme colors to CSS variables
function applyThemeColors(theme?: "dark" | "light") {
  const currentTheme = theme ?? config().theme;
  const defaults = currentTheme === "dark" ? DEFAULT_DARK_COLORS : DEFAULT_LIGHT_COLORS;
  const colors = currentTheme === "dark" ? darkColors() : lightColors();
  const root = document.documentElement;
  
  // Helper to use saved color or fall back to default
  const getColor = (key: keyof ThemeColors) => colors[key] || defaults[key];
  
  root.style.setProperty("--bg-primary", getColor("bg_primary"));
  root.style.setProperty("--bg-secondary", getColor("bg_secondary"));
  root.style.setProperty("--bg-elevated", getColor("bg_elevated"));
  root.style.setProperty("--bg-code", getColor("bg_code"));
  root.style.setProperty("--bg-inline-code", getColor("bg_inline_code"));
  root.style.setProperty("--bg-icon", getColor("bg_icon"));
  root.style.setProperty("--text-primary", getColor("text_primary"));
  root.style.setProperty("--text-secondary", getColor("text_secondary"));
  root.style.setProperty("--text-heading", getColor("text_heading"));
  root.style.setProperty("--text-link", getColor("text_link"));
  root.style.setProperty("--border-color", getColor("border_color"));
  root.style.setProperty("--code-border", getColor("code_border"));
  root.style.setProperty("--accent-color", getColor("accent_color"));
  root.style.setProperty("--table-header-bg", getColor("table_header_bg"));
  root.style.setProperty("--table-row-odd", getColor("table_row_odd"));
  root.style.setProperty("--table-row-even", getColor("table_row_even"));
  root.style.setProperty("--table-row-hover", getColor("table_row_hover"));
  root.style.setProperty("--btn-edit-active", getColor("btn_edit_active"));
  root.style.setProperty("--btn-save", getColor("btn_save"));
}

// Toggle theme
async function toggleTheme() {
  const newTheme = config().theme === "dark" ? "light" : "dark";
  const newConfig = { ...config(), theme: newTheme };
  setConfig(newConfig);
  document.documentElement.setAttribute("data-theme", newTheme);
  // Toggle light class for index.html splash screen styles
  if (newTheme === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
  localStorage.setItem("theme", newTheme);
  applyThemeColors(newTheme);
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
async function updateColor(theme: "dark" | "light", key: keyof ThemeColors, value: string) {
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

export {
  // Config and theme
  config,
  setConfig,
  darkColors,
  setDarkColors,
  lightColors,
  setLightColors,
  applyThemeColors,
  toggleTheme,
  saveSettings,
  updateColor,
  resetColors,
  // File state
  currentFile,
  setCurrentFile,
  content,
  setContent,
  originalContent,
  setOriginalContent,
  renderedHtml,
  setRenderedHtml,
  fileInfo,
  setFileInfo,
  isDirty,
  // UI state
  sidebarCollapsed,
  setSidebarCollapsed,
  sidebarWidth,
  setSidebarWidth,
  isResizing,
  setIsResizing,
  uiFontSize,
  setUiFontSize,
  markdownFontSize,
  setMarkdownFontSize,
  uiFontFamily,
  setUiFontFamily,
  markdownFontFamily,
  setMarkdownFontFamily,
  showSettings,
  setShowSettings,
  showRawMarkdown,
  setShowRawMarkdown,
};
