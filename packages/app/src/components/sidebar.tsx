/**
 * Collapsible sidebar with recent files, drafts, and quick actions.
 *
 * Features:
 * - Expandable/collapsible with Ctrl+B
 * - Resizable via drag handle (double-click to auto-fit)
 * - Shows recent files and unsaved drafts
 * - Quick access buttons when collapsed (1-9 shortcuts)
 * - Theme toggle, help, and settings in footer
 */
import { Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import {
  config,
  setConfig,
  currentFile,
  sidebarCollapsed,
  setSidebarCollapsed,
  sidebarWidth,
  setSidebarWidth,
  isResizing,
  setIsResizing,
  toggleTheme,
  setShowSettings,
  setShowHelp,
  drafts,
  currentDraftId,
} from "../stores/app-store";
import { getFilename, clamp, calculateSidebarWidth } from "../utils";

/** Props for Sidebar component */
interface SidebarProps {
  /** Handler to open file picker dialog */
  onOpenFile: () => void;
  /** Handler to load a file by path */
  onLoadFile: (path: string, addToHistory?: boolean) => Promise<void>;
  /** Handler to load a draft by ID */
  onLoadDraft: (id: string) => Promise<void>;
}

/**
 * Sidebar component with file history and navigation.
 */
export function Sidebar(props: SidebarProps) {
  // Toggle sidebar
  async function toggleSidebar() {
    const collapsed = !sidebarCollapsed();
    setSidebarCollapsed(collapsed);
    const newConfig = { ...config(), sidebar_collapsed: collapsed };
    setConfig(newConfig);
    await invoke("save_config", { config: newConfig });
  }

  // Sidebar resize handlers
  function startResize(e: MouseEvent) {
    e.preventDefault();
    setIsResizing(true);
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", stopResize);
  }

  function handleResize(e: MouseEvent) {
    if (!isResizing()) return;
    setSidebarWidth(clamp(e.clientX, 300, 500));
  }

  async function stopResize() {
    if (!isResizing()) return;
    setIsResizing(false);
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);
    const newConfig = { ...config(), sidebar_width: sidebarWidth() };
    setConfig(newConfig);
    await invoke("save_config", { config: newConfig });
  }

  // Auto-resize sidebar to fit content
  async function autoResizeSidebar() {
    const history = config().history;
    if (history.length === 0) return;

    const estimatedWidth = calculateSidebarWidth(history);
    setSidebarWidth(estimatedWidth);
    const newConfig = { ...config(), sidebar_width: estimatedWidth };
    setConfig(newConfig);
    await invoke("save_config", { config: newConfig });
  }

  return (
    <aside
      class={`sidebar ${sidebarCollapsed() ? "collapsed" : ""}`}
      style={{ width: sidebarCollapsed() ? "48px" : `${sidebarWidth()}px` }}
    >
      <div class="sidebar-header">
        <button
          class="btn btn-icon"
          onClick={toggleSidebar}
          title={sidebarCollapsed() ? "Expand (Ctrl+B)" : "Collapse (Ctrl+B)"}
        >
          {sidebarCollapsed() ? "☰" : "✕"}
        </button>
      </div>

      <Show when={!sidebarCollapsed()}>
        <div class="sidebar-content">
          <button class="btn btn-full" onClick={props.onOpenFile}>
            📂 Open File
          </button>

          <div class="history-section">
            <div class="history-title">Recent Files</div>
            <For each={config().history}>
              {(path) => (
                <div
                  class={`history-item ${currentFile() === path ? "active" : ""}`}
                  onClick={() => props.onLoadFile(path, false)}
                  title={path}
                >
                  📄 {getFilename(path)}
                </div>
              )}
            </For>
            <For each={drafts()}>
              {(draft) => (
                <div
                  class={`history-item draft ${currentDraftId() === draft.id ? "active" : ""}`}
                  onClick={() => props.onLoadDraft(draft.id)}
                  title={`Untitled-${draft.id.split("-")[1]} (unsaved)`}
                >
                  📄 Untitled-{draft.id.split("-")[1]}
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Collapsed sidebar buttons */}
      <Show when={sidebarCollapsed()}>
        <div class="sidebar-collapsed-buttons">
          <button
            class="btn btn-icon"
            onClick={props.onOpenFile}
            title="Open file (Ctrl+O)"
          >
            📂
          </button>
          <div class="recent-buttons">
            {(() => {
              const historyCount = config().history.length;
              return (
                <>
                  <For each={config().history.slice(0, 9)}>
                    {(path, index) => (
                      <button
                        class={`btn btn-icon ${currentFile() === path ? "active" : ""}`}
                        onClick={() => props.onLoadFile(path, false)}
                        title={`${path} (Ctrl+${index() + 1})`}
                      >
                        {index() + 1}
                      </button>
                    )}
                  </For>
                  <For each={drafts().slice(0, 9 - historyCount)}>
                    {(draft, index) => (
                      <button
                        class={`btn btn-icon draft ${currentDraftId() === draft.id ? "active" : ""}`}
                        onClick={() => props.onLoadDraft(draft.id)}
                        title={`Untitled-${draft.id.split("-")[1]} (unsaved)`}
                      >
                        {historyCount + index() + 1}
                      </button>
                    )}
                  </For>
                </>
              );
            })()}
          </div>
        </div>
      </Show>

      {/* Footer with theme, help and settings */}
      <div class="sidebar-footer">
        <Show when={!sidebarCollapsed()}>
          <button
            class="btn"
            onClick={toggleTheme}
            title="Toggle theme (Ctrl+T)"
          >
            {config().theme === "dark" ? "☀ Light" : "🌙 Dark"}
          </button>
          <button
            class="btn"
            onClick={() => { setShowSettings(false); setShowHelp(true); }}
            title="Help (Ctrl+H)"
          >
            ? Help
          </button>
          <button
            class="btn"
            onClick={() => { setShowHelp(false); setShowSettings(true); }}
            title="Settings (Ctrl+,)"
          >
            ⚙ Settings
          </button>
        </Show>

        <Show when={sidebarCollapsed()}>
          <button
            class="btn btn-icon"
            onClick={toggleTheme}
            title="Toggle theme (Ctrl+T)"
          >
            {config().theme === "dark" ? "☀" : "🌙"}
          </button>
          <button
            class="btn btn-icon"
            onClick={() => { setShowSettings(false); setShowHelp(true); }}
            title="Help (Ctrl+H)"
          >
            ?
          </button>
          <button
            class="btn btn-icon"
            onClick={() => { setShowHelp(false); setShowSettings(true); }}
            title="Settings (Ctrl+,)"
          >
            ⚙
          </button>
        </Show>
      </div>

      <Show when={!sidebarCollapsed()}>
        <div
          class="sidebar-resize-handle"
          onMouseDown={startResize}
          onDblClick={autoResizeSidebar}
        />
      </Show>
    </aside>
  );
}
