/**
 * Application state store using SolidJS signals.
 *
 * This module contains all reactive state for the application.
 * State is organized into logical groups:
 * - Config and theme
 * - File state
 * - Draft state (unsaved files)
 * - UI state
 * - Search state
 */
import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "../components/confirm-dialog";
import type { AppConfig, FileInfo, ThemeColors } from "../types";
import { DEFAULT_DARK_COLORS, DEFAULT_LIGHT_COLORS } from "../utils";

// ============================================================================
// Config and Theme State
// ============================================================================

/** Application configuration (persisted to disk) */
const [config, setConfig] = createSignal<AppConfig>({
  theme: "dark",
  history: [],
  sidebar_collapsed: false,
});

/** Custom dark theme colors */
const [darkColors, setDarkColors] = createSignal<ThemeColors>({ ...DEFAULT_DARK_COLORS });

/** Custom light theme colors */
const [lightColors, setLightColors] = createSignal<ThemeColors>({ ...DEFAULT_LIGHT_COLORS });

// ============================================================================
// File State
// ============================================================================

/** Currently open file path (null if no file or viewing draft) */
const [currentFile, setCurrentFile] = createSignal<string | null>(null);

/** Current markdown content being displayed/edited */
const [content, setContent] = createSignal<string>("");

/** Original content at load time (for dirty checking) */
const [originalContent, setOriginalContent] = createSignal<string>("");

/** Rendered HTML from markdown parser */
const [renderedHtml, setRenderedHtml] = createSignal<string>("");

/** Metadata for current file (size, modified date) */
const [fileInfo, setFileInfo] = createSignal<FileInfo | null>(null);

/** Whether current file is read-only (e.g., bundled changelog) */
const [isReadOnly, setIsReadOnly] = createSignal(false);

// ============================================================================
// Draft State
// ============================================================================

/**
 * In-memory unsaved document.
 * Drafts are temporary and lost on app close.
 */
export interface Draft {
  /** Unique identifier (e.g., "draft-1") */
  id: string;
  /** Draft content */
  content: string;
}

/** List of active drafts */
const [drafts, setDrafts] = createSignal<Draft[]>([]);

/** Currently active draft ID (null if viewing a file) */
const [currentDraftId, setCurrentDraftId] = createSignal<string | null>(null);

/** Counter for generating unique draft IDs */
let draftCounter = 0;

/**
 * Create a new empty draft
 * @returns The new draft's ID
 */
function createDraft(): string {
  draftCounter++;
  const id = `draft-${draftCounter}`;
  setDrafts([...drafts(), { id, content: "" }]);
  return id;
}

/**
 * Update a draft's content
 * @param id - Draft ID to update
 * @param content - New content
 */
function updateDraft(id: string, content: string) {
  setDrafts(drafts().map((d) => (d.id === id ? { ...d, content } : d)));
}

/**
 * Remove a draft by ID
 * @param id - Draft ID to remove
 */
function removeDraft(id: string) {
  setDrafts(drafts().filter((d) => d.id !== id));
  if (currentDraftId() === id) {
    setCurrentDraftId(null);
  }
}

/**
 * Get a draft by ID
 * @param id - Draft ID to find
 * @returns The draft or undefined if not found
 */
function getDraft(id: string): Draft | undefined {
  return drafts().find((d) => d.id === id);
}

// ============================================================================
// UI State
// ============================================================================

/** Whether sidebar is collapsed */
const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);

/** Sidebar width in pixels */
const [sidebarWidth, setSidebarWidth] = createSignal(220);

/** Whether user is resizing sidebar */
const [isResizing, setIsResizing] = createSignal(false);

/** UI font size in pixels */
const [uiFontSize, setUiFontSize] = createSignal(14);

/** Markdown content font size in pixels */
const [markdownFontSize, setMarkdownFontSize] = createSignal(14);

/** UI font family name */
const [uiFontFamily, setUiFontFamily] = createSignal("system");

/** Markdown content font family name */
const [markdownFontFamily, setMarkdownFontFamily] = createSignal("JetBrains Mono");

/** Whether settings modal is visible */
const [showSettings, setShowSettings] = createSignal(false);

/** Whether help modal is visible */
const [showHelp, setShowHelp] = createSignal(false);

/** Whether page overview modal is visible */
const [showPageOverview, setShowPageOverview] = createSignal(false);

/** Whether showing raw markdown (edit mode) vs rendered preview */
const [showRawMarkdown, setShowRawMarkdown] = createSignal(false);

/** Whether line numbers are shown in edit mode */
const [showLineNumbers, setShowLineNumbers] = createSignal(true);

// ============================================================================
// Search State
// ============================================================================

/** Whether search bar is visible */
const [showSearch, setShowSearch] = createSignal(false);

/** Current search query string */
const [searchQuery, setSearchQuery] = createSignal("");

/** Total number of search matches in document */
const [searchMatches, setSearchMatches] = createSignal<number>(0);

/** Currently highlighted match index (1-based) */
const [currentMatch, setCurrentMatch] = createSignal<number>(0);

/** 
 * Scroll anchor for syncing position between preview and edit modes.
 * Stores text content to search for when switching modes.
 */
const [scrollAnchor, setScrollAnchor] = createSignal<string | null>(null);

/**
 * Preview scroll anchor - line number from editor to scroll preview to.
 * Set before switching from edit to preview mode.
 */
const [previewScrollLine, setPreviewScrollLine] = createSignal<number | null>(null);

// ============================================================================
// Derived State
// ============================================================================

/**
 * Whether document has unsaved changes.
 * Only true in edit mode when content differs from original.
 */
const isDirty = () => showRawMarkdown() && content() !== originalContent();

// ============================================================================
// Theme Functions
// ============================================================================

/**
 * Apply current theme colors to CSS custom properties.
 * Uses saved colors with fallback to defaults.
 * @param theme - Theme to apply (defaults to current config theme)
 */
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
  root.style.setProperty("--draft-bg", getColor("draft_bg"));
  root.style.setProperty("--draft-bg-active", getColor("draft_bg_active"));
  root.style.setProperty("--draft-border", getColor("draft_border"));
  root.style.setProperty("--sidebar-active-bg", getColor("sidebar_active_bg"));
}

/**
 * Toggle between dark and light themes.
 * Persists to config and updates CSS.
 */
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

/**
 * Save current settings to config file.
 * Includes font sizes, font families, and theme colors.
 */
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

/**
 * Update a single theme color.
 * @param theme - Which theme to update ("dark" or "light")
 * @param key - Color key to update
 * @param value - New color value (CSS color string)
 */
async function updateColor(theme: "dark" | "light", key: keyof ThemeColors, value: string) {
  if (theme === "dark") {
    setDarkColors({ ...darkColors(), [key]: value });
  } else {
    setLightColors({ ...lightColors(), [key]: value });
  }
  applyThemeColors();
  await saveSettings();
}

/**
 * Reset a theme's colors to defaults.
 * Shows confirmation dialog before resetting.
 * @param theme - Which theme to reset
 */
async function resetColors(theme: "dark" | "light") {
  const confirmed = await confirm(`Reset ${theme} theme colors to defaults?`, "Reset Colors");
  if (!confirmed) return;

  if (theme === "dark") {
    setDarkColors({ ...DEFAULT_DARK_COLORS });
  } else {
    setLightColors({ ...DEFAULT_LIGHT_COLORS });
  }
  applyThemeColors();
  await saveSettings();
}

// ============================================================================
// Exports
// ============================================================================

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
  isReadOnly,
  setIsReadOnly,
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
  showHelp,
  setShowHelp,
  showPageOverview,
  setShowPageOverview,
  showRawMarkdown,
  setShowRawMarkdown,
  showLineNumbers,
  setShowLineNumbers,
  // Search state
  showSearch,
  setShowSearch,
  searchQuery,
  setSearchQuery,
  searchMatches,
  setSearchMatches,
  currentMatch,
  setCurrentMatch,
  // Scroll sync
  scrollAnchor,
  setScrollAnchor,
  previewScrollLine,
  setPreviewScrollLine,
  // Draft state
  drafts,
  setDrafts,
  currentDraftId,
  setCurrentDraftId,
  createDraft,
  updateDraft,
  removeDraft,
  getDraft,
};
