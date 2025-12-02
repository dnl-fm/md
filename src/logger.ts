/**
 * Frontend logging module.
 * Sends log messages to Rust backend for persistent file logging.
 * Falls back to console.log if Tauri invoke fails.
 *
 * Log file location: ~/.md/md.log
 */
import { invoke } from "@tauri-apps/api/core";

/** Log severity levels */
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

/**
 * Send a log message to the Rust backend
 */
async function log(level: LogLevel, message: string) {
  try {
    await invoke("log_message", { level, message });
  } catch {
    // Fallback to console if invoke fails
    console.log(`[${level}] ${message}`);
  }
}

/**
 * Logger instance with methods for each severity level.
 *
 * @example
 * ```ts
 * import { logger } from "./logger";
 * logger.info("File loaded successfully");
 * logger.error("Failed to save file");
 * ```
 */
export const logger = {
  /** Log debug message (verbose, development only) */
  debug: (msg: string) => log("DEBUG", msg),
  /** Log info message (general information) */
  info: (msg: string) => log("INFO", msg),
  /** Log warning message (potential issues) */
  warn: (msg: string) => log("WARN", msg),
  /** Log error message (failures) */
  error: (msg: string) => log("ERROR", msg),

  /**
   * Get the path to the log file
   * @returns Path to ~/.md/md.log or null if unavailable
   */
  async getLogPath(): Promise<string | null> {
    try {
      return await invoke<string | null>("get_log_path_cmd");
    } catch {
      return null;
    }
  },
};
