/**
 * Settings modal for customizing fonts and theme colors.
 *
 * Organized into tabs:
 * - UI: fonts and colors for app chrome (sidebar, buttons, etc.)
 * - Markdown: fonts and colors for rendered content (headings, code, tables)
 *
 * Each theme (dark/light) has its own color customization.
 * Colors can be reset to defaults per-theme.
 */
import { Show, For, createSignal } from "solid-js";
import type { ThemeColors } from "../types";
import {
  showSettings,
  setShowSettings,
  uiFontSize,
  setUiFontSize,
  uiFontFamily,
  setUiFontFamily,
  markdownFontSize,
  setMarkdownFontSize,
  markdownFontFamily,
  setMarkdownFontFamily,
  darkColors,
  lightColors,
  saveSettings,
  updateColor,
  resetColors,
} from "../stores/app-store";
import { FONT_OPTIONS, DEFAULT_DARK_COLORS, DEFAULT_LIGHT_COLORS } from "../utils";

// Helper to get color value with fallback to default
const getDarkColor = (key: keyof ThemeColors) => darkColors()[key] || DEFAULT_DARK_COLORS[key];
const getLightColor = (key: keyof ThemeColors) => lightColors()[key] || DEFAULT_LIGHT_COLORS[key];

type ColorGroup = {
  label: string;
  colors: { key: keyof ThemeColors; label: string }[];
};

const uiColorGroups: ColorGroup[] = [
  {
    label: "Backgrounds",
    colors: [
      { key: "bg_primary", label: "Primary" },
      { key: "bg_secondary", label: "Sidebar" },
      { key: "bg_elevated", label: "Elevated" },
      { key: "bg_icon", label: "Icons" },
    ],
  },
  {
    label: "Text",
    colors: [
      { key: "text_primary", label: "Primary" },
      { key: "text_secondary", label: "Secondary" },
      { key: "accent_color", label: "Accent" },
    ],
  },
  {
    label: "Borders",
    colors: [{ key: "border_color", label: "Default" }],
  },
  {
    label: "Buttons",
    colors: [
      { key: "btn_edit_active", label: "Edit Active" },
      { key: "btn_save", label: "Save" },
      { key: "btn_ai_chat", label: "AI Chat" },
    ],
  },
  {
    label: "Sidebar",
    colors: [{ key: "sidebar_active_bg", label: "Active Item" }],
  },
  {
    label: "Drafts",
    colors: [
      { key: "draft_bg", label: "Background" },
      { key: "draft_bg_active", label: "Active" },
      { key: "draft_border", label: "Border" },
    ],
  },
];

const markdownColorGroups: ColorGroup[] = [
  {
    label: "Text",
    colors: [
      { key: "text_heading", label: "Headings" },
      { key: "text_link", label: "Links" },
    ],
  },
  {
    label: "Code",
    colors: [
      { key: "bg_code", label: "Block Background" },
      { key: "bg_inline_code", label: "Inline Background" },
      { key: "text_code", label: "Plaintext Color" },
      { key: "code_border", label: "Border" },
    ],
  },
  {
    label: "Tables",
    colors: [
      { key: "table_header_bg", label: "Header" },
      { key: "table_row_odd", label: "Odd Row" },
      { key: "table_row_even", label: "Even Row" },
      { key: "table_row_hover", label: "Row Hover" },
    ],
  },
];

const mermaidColorGroups: ColorGroup[] = [
  {
    label: "Nodes",
    colors: [
      { key: "mermaid_node_bg", label: "Background" },
      { key: "mermaid_node_border", label: "Border" },
      { key: "mermaid_node_text", label: "Text" },
    ],
  },
  {
    label: "Connections",
    colors: [
      { key: "mermaid_line", label: "Lines & Arrows" },
    ],
  },
  {
    label: "Clusters / Subgraphs",
    colors: [
      { key: "mermaid_cluster_bg", label: "Background" },
      { key: "mermaid_cluster_border", label: "Border" },
    ],
  },
  {
    label: "Notes / Labels",
    colors: [
      { key: "mermaid_note_bg", label: "Background" },
      { key: "mermaid_note_border", label: "Border" },
    ],
  },
  {
    label: "ER Table Rows",
    colors: [
      { key: "mermaid_row_odd", label: "Odd Row" },
      { key: "mermaid_row_even", label: "Even Row" },
    ],
  },
];

type SettingsTab = "fonts" | "dark" | "light";
type ThemeSubTab = "ui" | "markdown" | "mermaid";

const tabs: { id: SettingsTab; label: string }[] = [
  { id: "fonts", label: "Fonts" },
  { id: "dark", label: "Dark Theme" },
  { id: "light", label: "Light Theme" },
];

const themeSubTabs: { id: ThemeSubTab; label: string }[] = [
  { id: "ui", label: "UI" },
  { id: "markdown", label: "Markdown" },
  { id: "mermaid", label: "Diagrams" },
];

/**
 * UI Preview - sidebar, buttons, elevated surfaces
 */
function UIPreview(props: { theme: "dark" | "light" }) {
  const c = () => props.theme === "dark" ? darkColors() : lightColors();
  
  return (
    <div class="theme-preview" style={{ background: c().bg_primary, color: c().text_primary }}>
      <h3 style={{ color: c().text_heading, margin: "0 0 24px 0" }}>UI Preview</h3>
      
      {/* Sidebar simulation */}
      <div class="preview-section">
        <div class="preview-label" style={{ color: c().text_secondary }}>Sidebar</div>
        <div style={{
          background: c().bg_secondary,
          border: `1px solid ${c().border_color}`,
          "border-radius": "8px",
          padding: "12px",
        }}>
          <div style={{ color: c().text_secondary, "font-size": "12px", "margin-bottom": "8px" }}>RECENT FILES</div>
          <div style={{ padding: "8px 12px", color: c().text_primary }}>document.md</div>
          <div style={{ padding: "8px 12px", background: c().sidebar_active_bg, "border-radius": "4px", color: c().text_primary }}>active-file.md</div>
          <div style={{ padding: "8px 12px", color: c().text_secondary }}>other-file.md</div>
        </div>
      </div>

      {/* Buttons */}
      <div class="preview-section">
        <div class="preview-label" style={{ color: c().text_secondary }}>Buttons</div>
        <div class="preview-row">
          <button class="preview-btn" style={{ background: c().accent_color, color: '#fff' }}>Primary</button>
          <button class="preview-btn" style={{ background: c().btn_edit_active, color: '#fff' }}>Edit Mode</button>
          <button class="preview-btn" style={{ background: c().btn_save, color: '#fff' }}>Save</button>
          <button class="preview-btn" style={{ background: c().btn_ai_chat, color: '#fff' }}>✨ AI</button>
          <button class="preview-btn" style={{ background: c().bg_icon, color: c().text_primary, border: `1px solid ${c().border_color}` }}>Icon</button>
        </div>
      </div>

      {/* Elevated surfaces */}
      <div class="preview-section">
        <div class="preview-label" style={{ color: c().text_secondary }}>Surfaces</div>
        <div class="preview-row">
          <div class="preview-box" style={{ background: c().bg_primary, border: `1px solid ${c().border_color}` }}>
            <span style={{ color: c().text_primary }}>Primary</span>
          </div>
          <div class="preview-box" style={{ background: c().bg_secondary, border: `1px solid ${c().border_color}` }}>
            <span style={{ color: c().text_primary }}>Secondary</span>
          </div>
          <div class="preview-box" style={{ background: c().bg_elevated, border: `1px solid ${c().border_color}` }}>
            <span style={{ color: c().text_primary }}>Elevated</span>
          </div>
        </div>
      </div>

      {/* Draft indicator */}
      <div class="preview-section">
        <div class="preview-label" style={{ color: c().text_secondary }}>Drafts</div>
        <div class="preview-row">
          <div class="preview-box" style={{ background: c().draft_bg, border: `1px solid ${c().draft_border}` }}>
            <span style={{ color: c().text_primary }}>Draft</span>
          </div>
          <div class="preview-box" style={{ background: c().draft_bg_active, border: `1px solid ${c().draft_border}` }}>
            <span style={{ color: c().text_primary }}>Active Draft</span>
          </div>
        </div>
      </div>

      {/* Text colors */}
      <div class="preview-section">
        <div class="preview-label" style={{ color: c().text_secondary }}>Text</div>
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
          <span style={{ color: c().text_primary }}>Primary text color</span>
          <span style={{ color: c().text_secondary }}>Secondary text color</span>
          <span style={{ color: c().accent_color }}>Accent color text</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Markdown Preview - headings, code, tables
 */
function MarkdownPreview(props: { theme: "dark" | "light" }) {
  const c = () => props.theme === "dark" ? darkColors() : lightColors();
  
  return (
    <div class="theme-preview" style={{ background: c().bg_primary, color: c().text_primary }}>
      <h3 style={{ color: c().text_heading, margin: "0 0 24px 0" }}>Markdown Preview</h3>
      
      {/* Headings */}
      <div class="preview-section">
        <div class="preview-label" style={{ color: c().text_secondary }}>Headings</div>
        <h1 style={{ color: c().text_heading, "font-size": "24px", margin: "0 0 8px 0" }}>Heading 1</h1>
        <h2 style={{ color: c().text_heading, "font-size": "20px", margin: "0 0 8px 0" }}>Heading 2</h2>
        <h3 style={{ color: c().text_heading, "font-size": "16px", margin: "0" }}>Heading 3</h3>
      </div>

      {/* Links */}
      <div class="preview-section">
        <div class="preview-label" style={{ color: c().text_secondary }}>Links</div>
        <p style={{ margin: 0 }}>
          This is a paragraph with a <a href="#" style={{ color: c().text_link }}>link to somewhere</a> in it.
        </p>
      </div>

      {/* Code */}
      <div class="preview-section">
        <div class="preview-label" style={{ color: c().text_secondary }}>Code</div>
        <div style={{
          background: c().bg_code,
          border: `1px solid ${c().code_border}`,
          "border-radius": "6px",
          padding: "16px",
          "font-family": "monospace",
          "margin-bottom": "12px",
        }}>
          <div style={{ color: c().text_secondary }}>{"// Plaintext code block"}</div>
          <div style={{ color: c().text_code }}>{"function hello() {"}</div>
          <div style={{ color: c().text_code, "padding-left": "20px" }}>{"console.log('Hello');"}</div>
          <div style={{ color: c().text_code }}>{"}"}</div>
        </div>
        <p style={{ margin: 0 }}>
          Inline code: <code style={{ background: c().bg_inline_code, padding: "2px 6px", "border-radius": "4px" }}>variable</code>
        </p>
      </div>

      {/* Table */}
      <div class="preview-section">
        <div class="preview-label" style={{ color: c().text_secondary }}>Table</div>
        <table class="preview-table" style={{ "border-color": c().border_color }}>
          <thead>
            <tr style={{ background: c().table_header_bg }}>
              <th style={{ color: c().text_primary, "border-color": c().border_color }}>Name</th>
              <th style={{ color: c().text_primary, "border-color": c().border_color }}>Type</th>
              <th style={{ color: c().text_primary, "border-color": c().border_color }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: c().table_row_odd }}>
              <td style={{ color: c().text_primary, "border-color": c().border_color }}>Item One</td>
              <td style={{ color: c().text_primary, "border-color": c().border_color }}>String</td>
              <td style={{ color: c().text_link, "border-color": c().border_color }}>Active</td>
            </tr>
            <tr style={{ background: c().table_row_even }}>
              <td style={{ color: c().text_primary, "border-color": c().border_color }}>Item Two</td>
              <td style={{ color: c().text_primary, "border-color": c().border_color }}>Number</td>
              <td style={{ color: c().text_secondary, "border-color": c().border_color }}>Pending</td>
            </tr>
            <tr style={{ background: c().table_row_odd }}>
              <td style={{ color: c().text_primary, "border-color": c().border_color }}>Item Three</td>
              <td style={{ color: c().text_primary, "border-color": c().border_color }}>Boolean</td>
              <td style={{ color: c().text_primary, "border-color": c().border_color }}>Done</td>
            </tr>
            <tr style={{ background: c().table_row_even }}>
              <td style={{ color: c().text_primary, "border-color": c().border_color }}>Item Four</td>
              <td style={{ color: c().text_primary, "border-color": c().border_color }}>Object</td>
              <td style={{ color: c().text_primary, "border-color": c().border_color }}>Ready</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Mermaid Preview - diagrams with all element types
 */
function MermaidPreview(props: { theme: "dark" | "light" }) {
  const c = () => props.theme === "dark" ? darkColors() : lightColors();
  
  return (
    <div class="theme-preview" style={{ background: c().bg_primary, color: c().text_primary }}>
      <h3 style={{ color: c().text_heading, margin: "0 0 24px 0" }}>Diagram Preview</h3>
      
      {/* Flowchart with Note */}
      <div class="preview-section">
        <div class="preview-label" style={{ color: c().text_secondary }}>Flowchart with Subgraph & Note</div>
        <svg viewBox="0 0 500 180" style={{ width: "100%", height: "180px", background: c().bg_primary }}>
          {/* Note at top */}
          <rect x="150" y="5" width="200" height="30" rx="4"
            fill={c().mermaid_note_bg}
            stroke={c().mermaid_note_border}
            stroke-width="1.5"
          />
          <text x="250" y="25" text-anchor="middle" font-size="11"
            fill={c().mermaid_node_text}>Note: Important info here</text>
          
          {/* Cluster/Subgraph */}
          <rect x="10" y="45" width="480" height="125" rx="8"
            fill={c().mermaid_cluster_bg}
            stroke={c().mermaid_cluster_border}
            stroke-width="2"
          />
          <text x="250" y="65" text-anchor="middle" font-size="12" font-weight="600"
            fill={c().mermaid_node_text}>Process Flow</text>
          
          {/* Node 1 */}
          <rect x="30" y="85" width="90" height="40" rx="6"
            fill={c().mermaid_node_bg}
            stroke={c().mermaid_node_border}
            stroke-width="2"
          />
          <text x="75" y="110" text-anchor="middle" font-size="12"
            fill={c().mermaid_node_text}>Start</text>
          
          {/* Arrow 1 */}
          <line x1="120" y1="105" x2="155" y2="105" stroke={c().mermaid_line} stroke-width="2" />
          <polygon points="155,101 163,105 155,109" fill={c().mermaid_line} />
          
          {/* Node 2 */}
          <rect x="165" y="85" width="90" height="40" rx="6"
            fill={c().mermaid_node_bg}
            stroke={c().mermaid_node_border}
            stroke-width="2"
          />
          <text x="210" y="110" text-anchor="middle" font-size="12"
            fill={c().mermaid_node_text}>Process</text>
          
          {/* Arrow 2 */}
          <line x1="255" y1="105" x2="290" y2="105" stroke={c().mermaid_line} stroke-width="2" />
          <polygon points="290,101 298,105 290,109" fill={c().mermaid_line} />
          
          {/* Decision diamond */}
          <polygon points="330,85 365,105 330,125 295,105"
            fill={c().mermaid_node_bg}
            stroke={c().mermaid_node_border}
            stroke-width="2"
          />
          <text x="330" y="109" text-anchor="middle" font-size="10"
            fill={c().mermaid_node_text}>?</text>
          
          {/* Arrow 3 */}
          <line x1="365" y1="105" x2="400" y2="105" stroke={c().mermaid_line} stroke-width="2" />
          <polygon points="400,101 408,105 400,109" fill={c().mermaid_line} />
          
          {/* Node 3 */}
          <rect x="410" y="85" width="70" height="40" rx="6"
            fill={c().mermaid_node_bg}
            stroke={c().mermaid_node_border}
            stroke-width="2"
          />
          <text x="445" y="110" text-anchor="middle" font-size="12"
            fill={c().mermaid_node_text}>End</text>
        </svg>
      </div>

      {/* ER Diagram with zebra striping */}
      <div class="preview-section">
        <div class="preview-label" style={{ color: c().text_secondary }}>ER Table with Zebra Striping</div>
        <svg viewBox="0 0 500 160" style={{ width: "100%", height: "160px", background: c().bg_primary }}>
          {/* Entity with zebra rows */}
          <rect x="20" y="10" width="200" height="140" rx="6"
            fill={c().mermaid_node_bg}
            stroke={c().mermaid_node_border}
            stroke-width="2"
          />
          {/* Header */}
          <rect x="20" y="10" width="200" height="30" rx="6"
            fill={c().mermaid_node_bg}
            stroke="none"
          />
          <text x="120" y="32" text-anchor="middle" font-size="13" font-weight="600"
            fill={c().mermaid_node_text}>users</text>
          <line x1="20" y1="40" x2="220" y2="40" stroke={c().mermaid_node_border} stroke-width="1" />
          
          {/* Row 1 - odd */}
          <rect x="21" y="41" width="198" height="24"
            fill={c().mermaid_row_odd}
          />
          <text x="30" y="58" font-size="11" fill={c().mermaid_node_text}>int</text>
          <text x="80" y="58" font-size="11" fill={c().mermaid_node_text}>id</text>
          <text x="180" y="58" font-size="10" fill={c().mermaid_line}>PK</text>
          
          {/* Row 2 - even */}
          <rect x="21" y="65" width="198" height="24"
            fill={c().mermaid_row_even}
          />
          <text x="30" y="82" font-size="11" fill={c().mermaid_node_text}>string</text>
          <text x="80" y="82" font-size="11" fill={c().mermaid_node_text}>name</text>
          
          {/* Row 3 - odd */}
          <rect x="21" y="89" width="198" height="24"
            fill={c().mermaid_row_odd}
          />
          <text x="30" y="106" font-size="11" fill={c().mermaid_node_text}>string</text>
          <text x="80" y="106" font-size="11" fill={c().mermaid_node_text}>email</text>
          
          {/* Row 4 - even */}
          <rect x="21" y="113" width="198" height="24"
            fill={c().mermaid_row_even}
          />
          <text x="30" y="130" font-size="11" fill={c().mermaid_node_text}>datetime</text>
          <text x="80" y="130" font-size="11" fill={c().mermaid_node_text}>created_at</text>
          
          {/* Relationship line */}
          <line x1="220" y1="80" x2="280" y2="80" stroke={c().mermaid_line} stroke-width="2" />
          <text x="250" y="70" text-anchor="middle" font-size="9" fill={c().mermaid_line}>1:N</text>
          
          {/* Second entity */}
          <rect x="280" y="30" width="200" height="100" rx="6"
            fill={c().mermaid_node_bg}
            stroke={c().mermaid_node_border}
            stroke-width="2"
          />
          <text x="380" y="52" text-anchor="middle" font-size="13" font-weight="600"
            fill={c().mermaid_node_text}>posts</text>
          <line x1="280" y1="60" x2="480" y2="60" stroke={c().mermaid_node_border} stroke-width="1" />
          
          {/* Rows */}
          <rect x="281" y="61" width="198" height="22" fill={c().mermaid_row_odd} />
          <text x="290" y="77" font-size="11" fill={c().mermaid_node_text}>int id</text>
          <text x="440" y="77" font-size="10" fill={c().mermaid_line}>PK</text>
          
          <rect x="281" y="83" width="198" height="22" fill={c().mermaid_row_even} />
          <text x="290" y="99" font-size="11" fill={c().mermaid_node_text}>int user_id</text>
          <text x="440" y="99" font-size="10" fill={c().mermaid_line}>FK</text>
          
          <rect x="281" y="105" width="198" height="22" fill={c().mermaid_row_odd} />
          <text x="290" y="121" font-size="11" fill={c().mermaid_node_text}>string title</text>
        </svg>
      </div>
    </div>
  );
}

/**
 * Get color groups for current sub-tab
 */
function getColorGroups(subTab: ThemeSubTab): ColorGroup[] {
  switch (subTab) {
    case "ui": return uiColorGroups;
    case "markdown": return markdownColorGroups;
    case "mermaid": return mermaidColorGroups;
  }
}

/**
 * Preview component based on sub-tab
 */
function ThemePreview(props: { theme: "dark" | "light"; subTab: ThemeSubTab }) {
  return (
    <>
      <Show when={props.subTab === "ui"}>
        <UIPreview theme={props.theme} />
      </Show>
      <Show when={props.subTab === "markdown"}>
        <MarkdownPreview theme={props.theme} />
      </Show>
      <Show when={props.subTab === "mermaid"}>
        <MermaidPreview theme={props.theme} />
      </Show>
    </>
  );
}

/**
 * Settings modal component.
 * Opens with Ctrl+, and closes with Escape.
 */
export function SettingsModal() {
  const [activeTab, setActiveTab] = createSignal<SettingsTab>("fonts");
  const [themeSubTab, setThemeSubTab] = createSignal<ThemeSubTab>("ui");

  return (
    <Show when={showSettings()}>
      <div class="modal-overlay" onClick={() => setShowSettings(false)}>
        <div class="modal modal-wide" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Settings</h2>
            <button
              class="btn btn-icon"
              onClick={() => setShowSettings(false)}
            >
              ✕
            </button>
          </div>

          <div class="settings-tabs">
            <For each={tabs}>
              {(tab) => (
                <button
                  class={`settings-tab ${activeTab() === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              )}
            </For>
          </div>

          <div class="modal-content">
            {/* Font Settings */}
            <Show when={activeTab() === "fonts"}>
              <div class="settings-section">
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
                        setMarkdownFontSize(Math.max(10, markdownFontSize() - 1));
                        saveSettings();
                      }}
                    >
                      −
                    </button>
                    <span class="font-size-value">{markdownFontSize()}px</span>
                    <button
                      class="btn btn-icon"
                      onClick={() => {
                        setMarkdownFontSize(Math.min(24, markdownFontSize() + 1));
                        saveSettings();
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            {/* Dark Theme Colors */}
            <Show when={activeTab() === "dark"}>
              <div class="settings-with-preview">
                <div class="settings-section">
                  <div class="theme-sub-tabs">
                    <For each={themeSubTabs}>
                      {(tab) => (
                        <button
                          class={`btn btn-small ${themeSubTab() === tab.id ? "active" : ""}`}
                          onClick={() => setThemeSubTab(tab.id)}
                        >
                          {tab.label}
                        </button>
                      )}
                    </For>
                    <button
                      class="btn btn-small reset-btn"
                      onClick={() => resetColors("dark")}
                    >
                      Reset
                    </button>
                  </div>
                  <For each={getColorGroups(themeSubTab())}>
                    {(group) => (
                      <div class="color-group">
                        <h4 class="color-group-label">{group.label}</h4>
                        <div class="color-grid">
                          <For each={group.colors}>
                            {(color) => (
                              <div class="color-item">
                                <label>{color.label}</label>
                                <input
                                  type="color"
                                  value={getDarkColor(color.key)}
                                  onInput={(e) =>
                                    updateColor("dark", color.key, e.currentTarget.value)
                                  }
                                />
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
                <ThemePreview theme="dark" subTab={themeSubTab()} />
              </div>
            </Show>

            {/* Light Theme Colors */}
            <Show when={activeTab() === "light"}>
              <div class="settings-with-preview">
                <div class="settings-section">
                  <div class="theme-sub-tabs">
                    <For each={themeSubTabs}>
                      {(tab) => (
                        <button
                          class={`btn btn-small ${themeSubTab() === tab.id ? "active" : ""}`}
                          onClick={() => setThemeSubTab(tab.id)}
                        >
                          {tab.label}
                        </button>
                      )}
                    </For>
                    <button
                      class="btn btn-small reset-btn"
                      onClick={() => resetColors("light")}
                    >
                      Reset
                    </button>
                  </div>
                  <For each={getColorGroups(themeSubTab())}>
                    {(group) => (
                      <div class="color-group">
                        <h4 class="color-group-label">{group.label}</h4>
                        <div class="color-grid">
                          <For each={group.colors}>
                            {(color) => (
                              <div class="color-item">
                                <label>{color.label}</label>
                                <input
                                  type="color"
                                  value={getLightColor(color.key)}
                                  onInput={(e) =>
                                    updateColor("light", color.key, e.currentTarget.value)
                                  }
                                />
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
                <ThemePreview theme="light" subTab={themeSubTab()} />
              </div>
            </Show>


          </div>
        </div>
      </div>
    </Show>
  );
}
