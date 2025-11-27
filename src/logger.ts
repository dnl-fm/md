import { invoke } from "@tauri-apps/api/core";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

async function log(level: LogLevel, message: string) {
  try {
    await invoke("log_message", { level, message });
  } catch {
    // Fallback to console if invoke fails
    console.log(`[${level}] ${message}`);
  }
}

export const logger = {
  debug: (msg: string) => log("DEBUG", msg),
  info: (msg: string) => log("INFO", msg),
  warn: (msg: string) => log("WARN", msg),
  error: (msg: string) => log("ERROR", msg),
  
  async getLogPath(): Promise<string | null> {
    try {
      return await invoke<string | null>("get_log_path_cmd");
    } catch {
      return null;
    }
  }
};
