export interface ThemeColors {
  bg_primary: string;
  bg_secondary: string;
  bg_elevated: string;
  bg_code: string;
  bg_inline_code: string;
  bg_icon: string;
  text_primary: string;
  text_secondary: string;
  text_heading: string;
  text_link: string;
  border_color: string;
  code_border: string;
  accent_color: string;
  table_header_bg: string;
  table_row_odd: string;
  table_row_even: string;
  table_row_hover: string;
  btn_edit_active: string;
  btn_save: string;
  draft_bg: string;
  draft_bg_active: string;
  draft_border: string;
}

export interface AppConfig {
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
  onboarding_complete?: boolean;
}

export interface FileInfo {
  size: number;
  modified: string;
}
