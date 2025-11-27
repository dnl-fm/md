import { Show, createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import {
  config,
  setConfig,
  setSidebarCollapsed,
  applyThemeColors,
} from "../stores/app-store";

interface WelcomeModalProps {
  show: boolean;
  onComplete: () => void;
}

export function WelcomeModal(props: WelcomeModalProps) {
  const [selectedTheme, setSelectedTheme] = createSignal<"dark" | "light">("dark");

  function previewTheme(theme: "dark" | "light") {
    setSelectedTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    localStorage.setItem("theme", theme);
    applyThemeColors(theme);
  }

  async function confirmTheme() {
    const theme = selectedTheme();
    const newConfig = {
      ...config(),
      theme,
      onboarding_complete: true,
      sidebar_collapsed: true,
    };
    setConfig(newConfig);
    setSidebarCollapsed(true);
    await invoke("save_config", { config: newConfig });
    props.onComplete();
  }

  return (
    <Show when={props.show}>
      <div class="modal-overlay">
        <div class="modal welcome-modal">
          <div class="welcome-header">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="64" height="64">
                <defs>
                  <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#6366f1"/>
                    <stop offset="100%" style="stop-color:#a855f7"/>
                  </linearGradient>
                </defs>
                <rect x="32" y="32" width="448" height="448" rx="96" ry="96" fill="url(#bgGrad)"/>
                <g transform="translate(256, 256) rotate(-3) translate(-256, -256)">
                  <rect x="120" y="100" width="272" height="312" rx="20" ry="20" fill="white"/>
                  <rect x="152" y="140" width="140" height="16" rx="4" fill="#e0e7ff"/>
                  <rect x="152" y="172" width="208" height="10" rx="3" fill="#c7d2fe"/>
                  <rect x="152" y="192" width="180" height="10" rx="3" fill="#c7d2fe"/>
                  <rect x="152" y="212" width="195" height="10" rx="3" fill="#c7d2fe"/>
                </g>
                <circle cx="380" cy="380" r="70" fill="#1e1b4b"/>
                <path d="M340 405 L340 355 L358 355 L380 382 L402 355 L420 355 L420 405 L405 405 L405 378 L380 405 L355 378 L355 405 Z" fill="white"/>
              </svg>
            </div>
            <h2>Welcome to MD</h2>
            <p>A fast, lightweight Markdown preview app</p>
          </div>

          <div class="welcome-content">
            <div class="theme-choices">
              <button 
                class={`theme-choice dark ${selectedTheme() === "dark" ? "selected" : ""}`} 
                onClick={() => previewTheme("dark")}
              >
                <div class="theme-preview dark-preview">
                  <div class="preview-header"></div>
                  <div class="preview-content">
                    <div class="preview-line"></div>
                    <div class="preview-line short"></div>
                  </div>
                </div>
                <span>Dark</span>
              </button>
              <button 
                class={`theme-choice light ${selectedTheme() === "light" ? "selected" : ""}`} 
                onClick={() => previewTheme("light")}
              >
                <div class="theme-preview light-preview">
                  <div class="preview-header"></div>
                  <div class="preview-content">
                    <div class="preview-line"></div>
                    <div class="preview-line short"></div>
                  </div>
                </div>
                <span>Light</span>
              </button>
            </div>
            
            <button class="btn welcome-confirm" onClick={confirmTheme}>
              Use {selectedTheme() === "dark" ? "Dark" : "Light"} Theme
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
