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

type SettingsTab = "fonts" | "dark" | "light";
type ThemeSubTab = "ui" | "markdown";

const tabs: { id: SettingsTab; label: string }[] = [
  { id: "fonts", label: "Fonts" },
  { id: "dark", label: "Dark Theme" },
  { id: "light", label: "Light Theme" },
];

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
              <div class="settings-section">
                <div class="theme-sub-tabs">
                  <button
                    class={`btn btn-small ${themeSubTab() === "ui" ? "active" : ""}`}
                    onClick={() => setThemeSubTab("ui")}
                  >
                    UI
                  </button>
                  <button
                    class={`btn btn-small ${themeSubTab() === "markdown" ? "active" : ""}`}
                    onClick={() => setThemeSubTab("markdown")}
                  >
                    Markdown
                  </button>
                  <button
                    class="btn btn-small reset-btn"
                    onClick={() => resetColors("dark")}
                  >
                    Reset
                  </button>
                </div>
                <For each={themeSubTab() === "ui" ? uiColorGroups : markdownColorGroups}>
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
            </Show>

            {/* Light Theme Colors */}
            <Show when={activeTab() === "light"}>
              <div class="settings-section">
                <div class="theme-sub-tabs">
                  <button
                    class={`btn btn-small ${themeSubTab() === "ui" ? "active" : ""}`}
                    onClick={() => setThemeSubTab("ui")}
                  >
                    UI
                  </button>
                  <button
                    class={`btn btn-small ${themeSubTab() === "markdown" ? "active" : ""}`}
                    onClick={() => setThemeSubTab("markdown")}
                  >
                    Markdown
                  </button>
                  <button
                    class="btn btn-small reset-btn"
                    onClick={() => resetColors("light")}
                  >
                    Reset
                  </button>
                </div>
                <For each={themeSubTab() === "ui" ? uiColorGroups : markdownColorGroups}>
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
            </Show>


          </div>
        </div>
      </div>
    </Show>
  );
}
