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

let resolvePromise: ((value: boolean) => void) | null = null;

/**
 * Show a confirmation dialog and wait for user response.
 * @param msg - Message to display in the dialog body
 * @param dialogTitle - Dialog title (default: "Confirm")
 * @returns Promise that resolves to true (OK) or false (Cancel)
 */
export function confirm(msg: string, dialogTitle = "Confirm"): Promise<boolean> {
  setMessage(msg);
  setTitle(dialogTitle);
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
              Cancel
            </button>
            <button class="btn btn-small btn-confirm" onClick={handleConfirm}>
              OK
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
