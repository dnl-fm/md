/**
 * Detect if the current page should be rendered as markdown
 */
export function shouldRenderPage(): boolean {
  const url = window.location.href;

  // Must be a markdown file URL
  if (!isMarkdownURL(url)) {
    return false;
  }

  // Check if content type indicates plain text
  // (Chrome doesn't expose Content-Type to content scripts, so we check the page structure)
  if (!isPlainTextPage()) {
    return false;
  }

  return true;
}

/**
 * Check if URL points to a markdown file
 */
function isMarkdownURL(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase();

  // Direct .md or .markdown files
  if (pathname.endsWith(".md") || pathname.endsWith(".markdown")) {
    return true;
  }

  // GitHub raw URLs (already matched by manifest, but double-check)
  if (url.includes("raw.githubusercontent.com") || url.includes("gist.githubusercontent.com")) {
    return true;
  }

  return false;
}

/**
 * Check if the page is plain text (not rendered HTML)
 */
function isPlainTextPage(): boolean {
  const body = document.body;

  // Plain text pages typically have a single <pre> element or just text
  if (body.children.length === 1 && body.children[0].tagName === "PRE") {
    return true;
  }

  // Some browsers render plain text with no children, just text nodes
  if (body.children.length === 0 && body.textContent && body.textContent.trim().length > 0) {
    return true;
  }

  // Check for common markdown indicators in the text
  const text = body.textContent || "";
  const hasMarkdownIndicators =
    text.includes("# ") || // Headers
    text.includes("## ") ||
    text.includes("```") || // Code blocks
    text.includes("- ") || // Lists
    text.includes("* ") ||
    text.includes("[") || // Links
    text.includes("**"); // Bold

  // If the page has very simple structure and markdown indicators, treat as markdown
  if (body.children.length <= 2 && hasMarkdownIndicators) {
    return true;
  }

  return false;
}

/**
 * Extract raw markdown content from the page
 */
export function getRawMarkdown(): string | null {
  const body = document.body;

  // Try to get from <pre> element (most common for raw files)
  const pre = body.querySelector("pre");
  if (pre) {
    return pre.textContent;
  }

  // Try direct text content
  if (body.children.length === 0) {
    return body.textContent;
  }

  // Fallback: get inner text
  return body.innerText || body.textContent;
}
