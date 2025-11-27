import type { ThemeColors } from "./types";

export const DEFAULT_DARK_COLORS: ThemeColors = {
  bg_primary: "#1e1e1e",
  bg_secondary: "#181818",
  bg_elevated: "#2a2a2a",
  bg_code: "#2a2a2a",
  bg_inline_code: "#3a3d42",
  bg_icon: "#2a2a2a",
  text_primary: "#d4d4d4",
  text_secondary: "#858585",
  text_heading: "#f0f0f0",
  text_link: "#64a0ff",
  border_color: "#3c3c3c",
  code_border: "#4a4a4a",
  accent_color: "#61afef",
  table_header_bg: "#323237",
  table_row_odd: "#1e1e1e",
  table_row_even: "#252528",
  table_row_hover: "#2a2a2d",
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
  border_color: "#d0d0d0",
  code_border: "#c0c0c0",
  accent_color: "#007acc",
  table_header_bg: "#e8e8eb",
  table_row_odd: "#ffffff",
  table_row_even: "#f8f8fa",
  table_row_hover: "#eef1f5",
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
