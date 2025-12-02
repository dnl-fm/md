/**
 * Confirm dialog component and utility function.
 *
 * Provides a promise-based confirmation dialog that can be used
 * anywhere in the app without prop drilling.
 *
 * @example
 * ```ts
 * import { confirm } from "./confirm-dialog";
 *
 * const confirmed = await confirm("Delete this file?", "Confirm Delete");
 * if (confirmed) {
 *   // User clicked OK
 * }
 * ```
 */
import { Show, onCleanup, createEffect } from "solid-js";
import { createSignal } from "solid-js";

// Module-level state for the singleton dialog
const [isOpen, setIsOpen] = createSignal(false);
const [message, setMessage] = createSignal("");
const [title, setTitle] = createSignal("Confirm");
const [confirmLabel, setConfirmLabel] = createSignal("OK");
const [cancelLabel, setCancelLabel] = createSignal("Cancel");

let resolvePromise: ((value: boolean) => void) | null = null;

/** Options for confirm dialog */
interface ConfirmOptions {
  /** Dialog title */
  title?: string;
  /** Label for confirm button (default: "OK") */
  confirmLabel?: string;
  /** Label for cancel button (default: "Cancel") */
  cancelLabel?: string;
}

/**
 * Show a confirmation dialog and wait for user response.
 * @param msg - Message to display in the dialog body
 * @param options - Dialog options (title, button labels) or just title string
 * @returns Promise that resolves to true (confirm) or false (cancel)
 */
export function confirm(msg: string, options?: string | ConfirmOptions): Promise<boolean> {
  setMessage(msg);
  
  if (typeof options === "string") {
    // Legacy: just title
    setTitle(options);
    setConfirmLabel("OK");
    setCancelLabel("Cancel");
  } else {
    setTitle(options?.title ?? "Confirm");
    setConfirmLabel(options?.confirmLabel ?? "OK");
    setCancelLabel(options?.cancelLabel ?? "Cancel");
  }
  
  setIsOpen(true);
  
  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
}

/**
 * Check if confirm dialog is currently open.
 * Useful for preventing other keyboard handlers while dialog is active.
 */
export function isConfirmOpen() {
  return isOpen();
}

function handleConfirm() {
  setIsOpen(false);
  resolvePromise?.(true);
  resolvePromise = null;
}

function handleCancel() {
  setIsOpen(false);
  resolvePromise?.(false);
  resolvePromise = null;
}

/**
 * Confirm dialog UI component.
 * Renders as a centered modal overlay when open.
 * Supports Enter to confirm and Escape to cancel.
 */
export function ConfirmDialog() {
  createEffect(() => {
    if (isOpen()) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          handleCancel();
        } else if (e.key === "Enter") {
          e.stopPropagation();
          handleConfirm();
        }
      };
      
      document.addEventListener("keydown", handleKeyDown, true);
      onCleanup(() => document.removeEventListener("keydown", handleKeyDown, true));
    }
  });

  return (
    <Show when={isOpen()}>
      <div class="modal-overlay" onClick={handleCancel}>
        <div class="confirm-dialog" onClick={(e) => e.stopPropagation()}>
          <h3>{title()}</h3>
          <p>{message()}</p>
          <div class="confirm-dialog-buttons">
            <button class="btn btn-small" onClick={handleCancel}>
              {cancelLabel()}
            </button>
            <button class="btn btn-small btn-confirm" onClick={handleConfirm}>
              {confirmLabel()}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
