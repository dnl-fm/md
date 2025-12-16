/**
 * Help modal showing keyboard shortcuts and version info.
 *
 * Displays:
 * - App version with changelog link
 * - Categorized keyboard shortcuts (General, Edit Mode, Navigation)
 *
 * Opens with Ctrl+H, closes with Escape or clicking outside.
 */
import { Show } from "solid-js";

/** Props for HelpModal component */
interface HelpModalProps {
  /** Whether to show the modal */
  show: boolean;
  /** App version string */
  version: string;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback to view the changelog */
  onViewChangelog: () => void;
}

/**
 * Help modal with keyboard shortcuts reference.
 */
export function HelpModal(props: HelpModalProps) {
  return (
    <Show when={props.show}>
      <div class="modal-overlay" onClick={props.onClose}>
        <div class="modal help-modal" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Help</h2>
            <button class="btn btn-icon" onClick={props.onClose}>
              ✕
            </button>
          </div>

          <div class="modal-content">
            {/* Version info */}
            <div class="help-version-section">
              <div class="help-version">
                <span class="help-version-label">MD</span>
                <span class="help-version-separator">—</span>
                <span class="help-version-number">{props.version}</span>
              </div>
              <button class="btn btn-small" onClick={props.onViewChangelog}>
                Changelog
              </button>
            </div>

            {/* Keyboard Shortcuts */}
            <div class="help-section">
              <h3>Keyboard Shortcuts</h3>

              <div class="shortcuts-group">
                <h4>Files</h4>
                <div class="shortcuts-list">
                  <div class="shortcut">
                    <kbd>Ctrl+N</kbd> New file
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+O</kbd> Open file
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+U</kbd> Open URL
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+W</kbd> Close file
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+S</kbd> Save file
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+1-9</kbd> Quick access
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+]</kbd> Next file
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+[</kbd> Previous file
                  </div>
                </div>
              </div>

              <div class="shortcuts-group">
                <h4>Editing</h4>
                <div class="shortcuts-list">
                  <div class="shortcut">
                    <kbd>Ctrl+Space</kbd> Toggle edit mode
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+Z</kbd> Undo
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+Y</kbd> Redo
                  </div>
                  <div class="shortcut">
                    <kbd>Tab</kbd> Indent
                  </div>
                  <div class="shortcut">
                    <kbd>Shift+Tab</kbd> Dedent
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+L</kbd> Toggle line numbers
                  </div>
                </div>
              </div>

              <div class="shortcuts-group">
                <h4>View</h4>
                <div class="shortcuts-list">
                  <div class="shortcut">
                    <kbd>Ctrl+F</kbd> Search
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+G</kbd> Table of contents
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+B</kbd> Toggle sidebar
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+T</kbd> Toggle theme
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
                </div>
              </div>

              <div class="shortcuts-group">
                <h4>App</h4>
                <div class="shortcuts-list">
                  <div class="shortcut">
                    <kbd>Ctrl+,</kbd> Settings
                  </div>
                  <div class="shortcut">
                    <kbd>Ctrl+H</kbd> Help
                  </div>
                  <div class="shortcut">
                    <kbd>Esc</kbd> Close / Cancel
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
