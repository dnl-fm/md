/**
 * Modal for entering a URL to fetch and display as markdown.
 *
 * Supports:
 * - Raw markdown URLs (raw.githubusercontent.com, etc.)
 * - HTML pages (converted to markdown via Turndown)
 *
 * Opens with Ctrl+U, closes with Escape or clicking outside.
 */
import { Show, createSignal, createEffect } from "solid-js";

/** Props for UrlInputModal component */
interface UrlInputModalProps {
  /** Whether to show the modal */
  show: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when URL is submitted */
  onSubmit: (url: string) => void;
  /** Error message to display */
  error?: string;
  /** Whether currently loading */
  loading?: boolean;
}

/**
 * URL input modal with centered input field.
 */
export function UrlInputModal(props: UrlInputModalProps) {
  const [url, setUrl] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  // Clear and focus input when modal opens
  createEffect(() => {
    if (props.show) {
      setUrl("");
      requestAnimationFrame(() => inputRef?.focus());
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    const value = url().trim();
    if (value && !props.loading) {
      props.onSubmit(value);
    }
  }

  function handleClose() {
    setUrl("");
    props.onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      handleClose();
    }
  }

  return (
    <Show when={props.show}>
      <div class="modal-overlay" onClick={handleClose} onKeyDown={handleKeyDown}>
        <div class="modal url-input-modal" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Open URL</h2>
            <button class="btn btn-icon" onClick={handleClose} disabled={props.loading}>
              ✕
            </button>
          </div>

          <form class="modal-content" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="url"
              class="url-input"
              placeholder="Enter URL..."
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value)}
              disabled={props.loading}
            />
            
            <Show when={props.error}>
              <div class="url-error">{props.error}</div>
            </Show>

            <div class="url-actions">
              <button 
                type="button" 
                class="btn" 
                onClick={handleClose}
                disabled={props.loading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                class="btn btn-primary" 
                disabled={!url().trim() || props.loading}
              >
                {props.loading ? "Loading..." : "Open"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}
