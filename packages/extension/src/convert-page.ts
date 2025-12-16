/**
 * Convert current HTML page to Markdown
 * Makes it look like a raw .md file, then content.js handles rendering
 */

import TurndownService from "turndown";

// Check if already converted
if (document.documentElement.hasAttribute("data-md-converted")) {
  console.log("MD: Page already converted");
} else {
  convertPage();
}

function convertPage() {
  document.documentElement.setAttribute("data-md-converted", "true");

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Remove non-content elements
  turndown.remove([
    "script", "style", "nav", "header", "footer", "aside",
    "iframe", "noscript", "svg", "form", "button", "input",
  ]);

  // Find main content
  const selectors = [
    "article", "main", "[role='main']",
    ".post-content", ".article-content", ".entry-content",
    ".post-body", ".article-body", "#content", ".content",
  ];

  let source: Element | null = null;
  for (const sel of selectors) {
    source = document.querySelector(sel);
    if (source) break;
  }
  source = source || document.body;

  // Convert
  const title = document.title || "Converted Page";
  const url = window.location.href;
  const markdown = `# ${title}\n\n> Source: ${url}\n\n---\n\n${turndown.turndown(source.innerHTML)}`;

  // Replace page with raw markdown (like a .md file)
  document.head.innerHTML = `<title>${title}</title>`;
  document.body.innerHTML = `<pre>${escapeHtml(markdown)}</pre>`;

  console.log("MD: Converted to markdown", { length: markdown.length });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
