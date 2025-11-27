import { Show } from "solid-js";
import {
  currentFile,
  fileInfo,
  isDirty,
  showRawMarkdown,
  setShowRawMarkdown,
  content,
  setContent,
  originalContent,
} from "../stores/app-store";
import { formatFileSize } from "../utils";

interface FileHeaderProps {
  onSaveAndPreview: () => void;
}

export function FileHeader(props: FileHeaderProps) {
  return (
    <Show when={currentFile()}>
      <div class="file-header">
        <span class="file-path">📄 {currentFile()}</span>
        <div class="file-header-right">
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
          <Show when={fileInfo()}>
            <span class="file-meta">
              {formatFileSize(fileInfo()!.size)} · {fileInfo()!.modified}
            </span>
          </Show>
        </div>
      </div>
    </Show>
  );
}
