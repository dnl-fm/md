import { Show, onCleanup, createEffect } from "solid-js";
import { createSignal } from "solid-js";

const [isOpen, setIsOpen] = createSignal(false);
const [message, setMessage] = createSignal("");
const [title, setTitle] = createSignal("Confirm");

let resolvePromise: ((value: boolean) => void) | null = null;

export function confirm(msg: string, dialogTitle = "Confirm"): Promise<boolean> {
  setMessage(msg);
  setTitle(dialogTitle);
  setIsOpen(true);
  
  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
}

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
