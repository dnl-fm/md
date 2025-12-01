import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { config, setConfig } from "../stores/app-store";

interface ReleaseNotificationProps {
  version: string;
  onDismiss: () => void;
  onLoadFile: (path: string) => Promise<void>;
}

export function ReleaseNotification(props: ReleaseNotificationProps) {
  const [isLeaving, setIsLeaving] = createSignal(false);

  async function dismissNotification() {
    setIsLeaving(true);
    // Wait for animation to complete
    setTimeout(async () => {
      // Save that user has seen this version
      const newConfig = { ...config(), last_seen_version: props.version };
      setConfig(newConfig);
      await invoke("save_config", { config: newConfig });
      props.onDismiss();
    }, 200);
  }

  async function viewChangelog() {
    try {
      const changelogPath = await invoke<string>("get_changelog_path");
      await props.onLoadFile(changelogPath);
      dismissNotification();
    } catch (err) {
      console.error("Failed to load changelog:", err);
    }
  }

  return (
    <div class={`release-notification ${isLeaving() ? "leaving" : ""}`}>
      <div class="release-notification-content">
        <div class="release-notification-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div class="release-notification-text">
          <div class="release-notification-title">New Release {props.version}</div>
        </div>
        <button class="release-notification-close" onClick={dismissNotification} title="Dismiss">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <button class="release-notification-btn" onClick={viewChangelog}>
        View Changelog
      </button>
    </div>
  );
}
