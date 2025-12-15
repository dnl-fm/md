/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App";

// Hide splash screen after app renders
function hideSplash() {
  const splash = document.getElementById("splash");
  if (splash) {
    splash.classList.add("hidden");
    // Remove from DOM after transition
    setTimeout(() => splash.remove(), 300);
  }
}

// Expose globally so App can call when fully ready
(window as any).hideSplash = hideSplash;

render(() => <App />, document.getElementById("root") as HTMLElement);
