import type { ThemeColors } from "./types";

export const DEFAULT_DARK_COLORS: ThemeColors = {
  bg_primary: "#22272e",       // Balanced dark, not too dark
  bg_secondary: "#1c2128",     // Slightly darker for sidebar
  bg_elevated: "#2d333b",      // Elevated surfaces
  bg_code: "#2d333b",          // Code blocks
  bg_inline_code: "#363d47",   // Inline code
  bg_icon: "#2d333b",          // Icon backgrounds
  text_primary: "#adbac7",     // Soft primary text
  text_secondary: "#768390",   // Muted secondary text
  text_heading: "#cdd9e5",     // Slightly brighter headings
  text_link: "#539bf5",        // Blue links
  text_code: "#adbac7",        // Code block text (plaintext)
  border_color: "#373e47",     // Subtle borders
  code_border: "#444c56",      // Code block borders
  accent_color: "#539bf5",     // Blue accent
  table_header_bg: "#2d333b",  // Table header
  table_row_odd: "#22272e",    // Table odd rows
  table_row_even: "#2d333b",   // Table even rows
  table_row_hover: "#373e47",  // Table hover
  btn_edit_active: "#a371f7",  // Purple for edit
  btn_save: "#539bf5",         // Blue save
  draft_bg: "#3d3000",         // Draft indicator
  draft_bg_active: "#7a6620",
  draft_border: "#4a4a4a",
  sidebar_active_bg: "#3a3a3a",
  // Mermaid diagram colors
  mermaid_node_bg: "#2d333b",
  mermaid_node_border: "#4a6a7a",
  mermaid_node_text: "#adbac7",
  mermaid_line: "#5a6a7a",
  mermaid_cluster_bg: "#262c33",
  mermaid_cluster_border: "#4a5a6a",
  mermaid_note_bg: "#3a3a4a",
  mermaid_note_border: "#5a5a7a",
  mermaid_row_odd: "#262c33",
  mermaid_row_even: "#2d333b",
};

export const DEFAULT_LIGHT_COLORS: ThemeColors = {
  bg_primary: "#ffffff",
  bg_secondary: "#f5f5f5",
  bg_elevated: "#fafafa",
  bg_code: "#f5f5f5",
  bg_inline_code: "#D9DCE3",
  bg_icon: "#e8e8eb",
  text_primary: "#242424",
  text_secondary: "#666666",
  text_heading: "#141414",
  text_link: "#0066cc",
  text_code: "#242424",        // Code block text (plaintext)
  border_color: "#d0d0d0",
  code_border: "#c0c0c0",
  accent_color: "#007acc",
  table_header_bg: "#e8e8eb",
  table_row_odd: "#ffffff",
  table_row_even: "#f8f8fa",
  table_row_hover: "#eef1f5",
  btn_edit_active: "#9333ea",
  btn_save: "#2563eb",
  draft_bg: "#ffefaf",
  draft_bg_active: "#ffe065",
  draft_border: "#cccccc",
  sidebar_active_bg: "#fff7d9",
  // Mermaid diagram colors
  mermaid_node_bg: "#ffffff",
  mermaid_node_border: "#c8e1ff",
  mermaid_node_text: "#24292f",
  mermaid_line: "#8b949e",
  mermaid_cluster_bg: "#f6f8fa",
  mermaid_cluster_border: "#c8e1ff",
  mermaid_note_bg: "#fff8c5",
  mermaid_note_border: "#d4a72c",
  mermaid_row_odd: "#f6f8fa",
  mermaid_row_even: "#ffffff",
};

export const FONT_OPTIONS = [
  { value: "system", label: "System Default" },
  { value: "JetBrains Mono", label: "JetBrains Mono" },
  { value: "Fira Code", label: "Fira Code" },
  { value: "SF Mono", label: "SF Mono" },
  { value: "Consolas", label: "Consolas" },
  { value: "Monaco", label: "Monaco" },
  { value: "Ubuntu Mono", label: "Ubuntu Mono" },
  { value: "Source Code Pro", label: "Source Code Pro" },
];

/**
 * Get CSS font-family value for a font option
 */
export function getFontFamilyCSS(font: string): string {
  if (font === "system") {
    return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Ubuntu, sans-serif';
  }
  return `"${font}", "Fira Code", "SF Mono", Consolas, monospace`;
}

/**
 * Extract filename from a file path
 */
export function getFilename(path: string): string {
  return path.split("/").pop() || path;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Generate a URL-friendly slug from text
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Clamp a number between min and max values
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalize markdown text for consistent parsing.
 *
 * LLMs often output typographic characters that aren't recognized by markdown parsers:
 * - En-dash (–) U+2013 and em-dash (—) U+2014 instead of hyphen (-) for list items
 *
 * This function converts these to their ASCII equivalents at line start positions.
 *
 * @param md - Raw markdown string
 * @returns Normalized markdown with ASCII list markers
 */
export function normalizeMarkdown(md: string): string {
  return md.replace(/^[–—]\s/gm, "- ");
}

/**
 * Calculate estimated width for sidebar based on filenames
 */
export function calculateSidebarWidth(history: string[]): number {
  if (history.length === 0) return 180;

  const longestName = history.reduce((longest, path) => {
    const name = getFilename(path);
    return name.length > longest.length ? name : longest;
  }, "");

  // Approximate width: icon + text + padding (rough estimate: 8px per char + 80px for icon/padding)
  return clamp(longestName.length * 8 + 80, 180, 400);
}
