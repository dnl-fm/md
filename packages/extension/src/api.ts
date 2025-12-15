/**
 * API utilities for server-side rendering
 */

const API_BASE = "https://api.getmd.dev";

/**
 * Generate SHA-256 hash of text
 */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Base64 URL-safe encoding
 */
function base64UrlEncode(text: string): string {
  return btoa(text)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Render a mermaid diagram via API
 * @param code - Raw mermaid diagram code
 * @param theme - Theme (dark or light)
 * @returns SVG string or null on error
 */
export async function renderMermaid(
  code: string,
  theme: "dark" | "light"
): Promise<string | null> {
  try {
    const hash = await sha256(code);
    const encoded = base64UrlEncode(code);

    const response = await fetch(
      `${API_BASE}/render/mermaid/${theme}/${hash}?code=${encoded}`,
      {
        method: "GET",
        headers: {
          Accept: "image/svg+xml",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.warn("MD: Failed to render mermaid diagram:", error.error);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.warn("MD: Failed to fetch mermaid diagram:", error);
    return null;
  }
}

/**
 * Render an ASCII diagram via API
 * @param code - Raw ASCII diagram code
 * @returns Rendered text or null on error
 */
export async function renderASCII(code: string): Promise<string | null> {
  try {
    const hash = await sha256(code);
    const encoded = base64UrlEncode(code);

    const response = await fetch(
      `${API_BASE}/render/ascii/${hash}?code=${encoded}`,
      {
        method: "GET",
        headers: {
          Accept: "text/plain",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.warn("MD: Failed to render ASCII diagram:", error.error);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.warn("MD: Failed to fetch ASCII diagram:", error);
    return null;
  }
}
