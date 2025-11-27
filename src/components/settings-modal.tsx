import { Show, For } from "solid-js";
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
import { FONT_OPTIONS } from "../utils";

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

export function SettingsModal() {
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
  );
}
