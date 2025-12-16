/**
 * File header bar showing current file info and action buttons.
 *
 * Displays differently for:
 * - Saved files: path, edit/save/cancel buttons, file metadata
 * - Drafts: "Untitled" name, edit/preview toggle, "Save As" button
 * - Read-only files: no edit button (e.g., bundled changelog)
 */
import { Show } from "solid-js";
import {
  currentFile,
  fileInfo,
  isDirty,
  isReadOnly,
  showRawMarkdown,
  setShowRawMarkdown,
  setContent,
  originalContent,
  content,
  currentDraftId,
  getDraft,
} from "../stores/app-store";
import { saveToCloud } from "../stores/cloud-sync-store";
import { formatFileSize } from "../utils";

/** Props for FileHeader component */
interface FileHeaderProps {
  /** Handler to save current file and switch to preview mode */
  onSaveAndPreview: () => void;
  /** Handler to save draft to a new file */
  onSaveDraft?: () => void;
  /** Handler to print document as PDF */
  onPrint?: () => void;
  /** Whether page previews are being rendered in background */
  isPreRendering?: boolean;
}

/**
 * Header bar with file info and action buttons.
 */
export function FileHeader(props: FileHeaderProps) {
  return (
    <>
      {/* Header for existing files */}
      <Show when={currentFile()}>
        <div class="file-header">
          <span class="file-path">📄 {currentFile()}</span>
          <div class="file-header-right">
            <Show when={props.isPreRendering}>
              <span class="prerender-spinner" title="Generating page previews...">
                <svg class="spinner-icon" viewBox="0 0 24 24" width="14" height="14">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4 31.4" />
                </svg>
                <span class="prerender-text">Generating previews...</span>
              </span>
            </Show>
            <Show when={isDirty()}>
              <button
                class="btn btn-small"
                onClick={() => {
                  setContent(originalContent());
                  setShowRawMarkdown(false);
                }}
                title="Discard changes (Esc)"
              >
                Cancel
              </button>
            </Show>
            <Show when={!isReadOnly()}>
              <button
                class={`btn btn-small ${showRawMarkdown() ? "active" : ""} ${isDirty() ? "btn-dirty" : ""}`}
                onClick={() => {
                  if (showRawMarkdown()) {
                    props.onSaveAndPreview();
                  } else {
                    setShowRawMarkdown(true);
                  }
                }}
                title={
                  showRawMarkdown()
                    ? isDirty()
                      ? "Save changes (Ctrl+S)"
                      : "Back to preview (Esc)"
                    : "Edit markdown (Ctrl+Space)"
                }
              >
                {showRawMarkdown() ? (isDirty() ? "Save" : "Preview") : "Edit"}
              </button>
            </Show>
            <button
              class="btn btn-small no-print"
              onClick={() => props.onPrint?.()}
              title="Print / Export PDF (Ctrl+P)"
            >
              Print
            </button>
            <button
              class="btn btn-small no-print"
              onClick={async () => {
                const title = currentFile()?.split('/').pop()?.replace(/\.md$/, '') || 'Untitled';
                await saveToCloud(title, content());
              }}
              title="Save to Cloud"
            >
              ☁️ Save to Cloud
            </button>
            <Show when={fileInfo()}>
              <span class="file-meta">
                {formatFileSize(fileInfo()!.size)} · {fileInfo()!.modified}
              </span>
            </Show>
          </div>
        </div>
      </Show>

      {/* Header for drafts */}
      <Show when={currentDraftId()}>
        {(() => {
          const draft = getDraft(currentDraftId()!);
          const displayName = draft?.sourceTitle 
            ? draft.sourceTitle 
            : `Untitled-${currentDraftId()?.split("-")[1]}`;
          return (
            <div class="file-header">
              <span class="file-path">📄 {displayName} (unsaved)</span>
              <div class="file-header-right">
                <Show when={props.isPreRendering}>
                  <span class="prerender-spinner" title="Generating page previews...">
                    <svg class="spinner-icon" viewBox="0 0 24 24" width="14" height="14">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4 31.4" />
                    </svg>
                    <span class="prerender-text">Generating previews...</span>
                  </span>
                </Show>
                <button
                  class={`btn btn-small ${showRawMarkdown() ? "active" : ""}`}
                  onClick={() => setShowRawMarkdown(!showRawMarkdown())}
                  title={showRawMarkdown() ? "Preview (Ctrl+Space)" : "Edit (Ctrl+Space)"}
                >
                  {showRawMarkdown() ? "Preview" : "Edit"}
                </button>
                <button
                  class="btn btn-small btn-save"
                  onClick={() => props.onSaveDraft?.()}
                  title="Save to file (Ctrl+S)"
                >
                  Save As
                </button>
                <button
                  class="btn btn-small no-print"
                  onClick={() => props.onPrint?.()}
                  title="Print / Export PDF (Ctrl+P)"
                >
                  Print
                </button>
                <span class="file-meta">
                  {formatFileSize(content().length)}
                </span>
              </div>
            </div>
          );
        })()}
      </Show>
    </>
  );
}
