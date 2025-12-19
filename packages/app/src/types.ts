/**
 * Theme color configuration for customizable UI elements.
 * All values are CSS color strings (hex, rgb, hsl, etc.)
 */
export interface ThemeColors {
  /** Main background color */
  bg_primary: string;
  /** Sidebar and secondary areas background */
  bg_secondary: string;
  /** Elevated elements (modals, dropdowns) background */
  bg_elevated: string;
  /** Code block background */
  bg_code: string;
  /** Inline code background */
  bg_inline_code: string;
  /** Icon button background */
  bg_icon: string;
  /** Main text color */
  text_primary: string;
  /** Muted/secondary text color */
  text_secondary: string;
  /** Heading text color */
  text_heading: string;
  /** Link text color */
  text_link: string;
  /** Code block text color (plaintext) */
  text_code: string;
  /** Border color for dividers and inputs */
  border_color: string;
  /** Code block border color */
  code_border: string;
  /** Accent color for focus states and highlights */
  accent_color: string;
  /** Table header background */
  table_header_bg: string;
  /** Table odd row background */
  table_row_odd: string;
  /** Table even row background */
  table_row_even: string;
  /** Table row hover background */
  table_row_hover: string;
  /** Edit mode button active state */
  btn_edit_active: string;
  /** Save button color */
  btn_save: string;
  /** Draft indicator background */
  draft_bg: string;
  /** Active draft background */
  draft_bg_active: string;
  /** Draft border color */
  draft_border: string;
  /** Active sidebar item background */
  sidebar_active_bg: string;
  /** Mermaid diagram node background */
  mermaid_node_bg: string;
  /** Mermaid diagram node border */
  mermaid_node_border: string;
  /** Mermaid diagram text color */
  mermaid_node_text: string;
  /** Mermaid diagram line/arrow color */
  mermaid_line: string;
  /** Mermaid diagram cluster/subgraph background */
  mermaid_cluster_bg: string;
  /** Mermaid diagram cluster border */
  mermaid_cluster_border: string;
  /** Mermaid diagram note/label background */
  mermaid_note_bg: string;
  /** Mermaid diagram note/label border */
  mermaid_note_border: string;
  /** Mermaid ER table odd row background */
  mermaid_row_odd: string;
  /** Mermaid ER table even row background */
  mermaid_row_even: string;
  /** AI chat button background */
  btn_ai_chat: string;
}

/**
 * Application configuration persisted to ~/.md/config.json
 */
export interface AppConfig {
  /** Current theme: "dark" or "light" */
  theme: string;
  /** Recently opened file paths (max 20, most recent last) */
  history: string[];
  /** Whether sidebar is collapsed */
  sidebar_collapsed: boolean;
  /** Sidebar width in pixels */
  sidebar_width?: number;
  /** UI font size in pixels */
  ui_font_size?: number;
  /** Markdown content font size in pixels */
  markdown_font_size?: number;
  /** UI font family name */
  ui_font_family?: string;
  /** Markdown content font family name */
  markdown_font_family?: string;
  /** Custom dark theme colors */
  dark_colors?: ThemeColors;
  /** Custom light theme colors */
  light_colors?: ThemeColors;
  /** Whether user completed onboarding */
  onboarding_complete?: boolean;
  /** Last version user saw release notes for */
  last_seen_version?: string;
  /** AI chat panel width as percentage (0-100) */
  ai_chat_width?: number;
}

/**
 * File metadata returned from Rust backend
 */
export interface FileInfo {
  /** File size in bytes */
  size: number;
  /** Last modified timestamp (ISO 8601) */
  modified: string;
}
