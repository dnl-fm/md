import MarkdownIt from "markdown-it";
import { shouldRenderPage, getRawMarkdown } from "./detector";
import { buildTOC, type TOCEntry } from "./toc";

// Initialize markdown-it
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
});

// State
let tocEntries: TOCEntry[] = [];
let tocVisible = false;

// Header height for scroll offset
const HEADER_HEIGHT = 48;

/**
 * Main entry point
 */
async function main() {
  if (!shouldRenderPage()) {
    return;
  }

  const rawMarkdown = getRawMarkdown();
  if (!rawMarkdown) {
    return;
  }

  // Render markdown
  const html = md.render(rawMarkdown);
  tocEntries = buildTOC(rawMarkdown);

  // Replace page content
  replacePageContent(html);

  // Add IDs to headings for TOC navigation
  addHeadingIds();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

  // Setup code block highlighting (lazy load shiki)
  await highlightCodeBlocks();

  // Setup mermaid diagrams (lazy load)
  await renderMermaidDiagrams();
}

/**
 * Get current theme
 */
function getCurrentTheme(): "dark" | "light" {
  const saved = localStorage.getItem("md-theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Replace page content with rendered markdown
 */
function replacePageContent(html: string) {
  const filename = getFilenameFromURL();
  const theme = getCurrentTheme();

  document.documentElement.innerHTML = `
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${filename} - MD</title>
      <link rel="stylesheet" href="${chrome.runtime.getURL("styles.css")}">
    </head>
    <body>
      <div class="md-app-container">
        <!-- Sidebar (collapsed) -->
        <aside class="md-sidebar">
          <div class="md-sidebar-header">
            <button class="md-btn md-btn-icon" id="md-toc-btn" title="Table of Contents (Ctrl+G)">
              ☰
            </button>
          </div>
          <div class="md-sidebar-content">
            <!-- Empty for extension -->
          </div>
          <div class="md-sidebar-footer">
            <button class="md-btn md-btn-icon" id="md-theme-btn" title="Toggle theme (Ctrl+T)">
              ${theme === "dark" ? "☀" : "🌙"}
            </button>
          </div>
        </aside>

        <!-- Main content -->
        <main class="md-main-content">
          <div class="md-file-header">
            <span class="md-file-path">📄 ${escapeHtml(filename)}</span>
            <div class="md-file-header-right">
              <a class="md-btn md-btn-small" href="${window.location.href}" target="_blank" title="Open original">
                Raw
              </a>
            </div>
          </div>
          <div class="md-content" id="md-content">
            <div class="markdown-body">
              ${html}
            </div>
          </div>
        </main>

        <!-- TOC Panel -->
        <div class="md-toc-backdrop" id="md-toc-backdrop"></div>
        <aside class="md-toc" id="md-toc">
          <div class="md-toc-header">
            <span>Table of Contents</span>
            <button class="md-btn md-toc-close" id="md-toc-close">×</button>
          </div>
          <nav class="md-toc-nav" id="md-toc-nav"></nav>
        </aside>
      </div>
    </body>
  `;

  // Apply theme
  document.documentElement.setAttribute("data-theme", theme);

  // Render TOC
  renderTOC();

  // Setup button handlers
  document.getElementById("md-toc-btn")?.addEventListener("click", toggleTOC);
  document.getElementById("md-toc-close")?.addEventListener("click", () => setTOCVisible(false));
  document.getElementById("md-toc-backdrop")?.addEventListener("click", () => setTOCVisible(false));
  document.getElementById("md-theme-btn")?.addEventListener("click", toggleTheme);
}

/**
 * Add IDs to headings for anchor navigation
 */
function addHeadingIds() {
  const content = document.getElementById("md-content");
  if (!content) return;

  const usedIds = new Set<string>();
  const headings = content.querySelectorAll("h1, h2, h3, h4, h5, h6");

  headings.forEach((heading) => {
    const text = heading.textContent || "";
    const id = generateId(text, usedIds);
    heading.id = id;
  });
}

/**
 * Generate a unique slug ID
 */
function generateId(text: string, usedIds: Set<string>): string {
  let id = text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");

  const baseId = id;
  let counter = 1;
  while (usedIds.has(id)) {
    id = `${baseId}-${counter++}`;
  }
  usedIds.add(id);

  return id;
}

/**
 * Render TOC navigation
 */
function renderTOC() {
  const nav = document.getElementById("md-toc-nav");
  if (!nav) return;

  if (tocEntries.length === 0) {
    nav.innerHTML = '<p class="md-toc-empty">No headings found</p>';
    return;
  }

  nav.innerHTML = tocEntries
    .map(
      (entry, index) => `
      <a href="#${entry.id}" data-toc-index="${index}" class="md-toc-item md-toc-level-${entry.level}">
        <span class="md-toc-item-text">${escapeHtml(entry.text)}</span>
      </a>
    `
    )
    .join("");

  // Handle TOC clicks - scroll to heading with offset and highlight
  nav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const index = parseInt(a.getAttribute("data-toc-index") || "0", 10);
      scrollToHeading(index);
    });
  });
}

/**
 * Scroll to heading by index and highlight it
 */
function scrollToHeading(index: number) {
  const content = document.getElementById("md-content");
  if (!content) return;

  const headings = content.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const heading = headings[index] as HTMLElement;
  
  if (!heading) return;

  // Scroll to heading with offset for sticky header
  const targetPosition = heading.getBoundingClientRect().top + window.scrollY;
  const scrollTarget = targetPosition - HEADER_HEIGHT - 16;
  
  window.scrollTo({
    top: scrollTarget,
    behavior: "smooth"
  });

  // Wait for scroll to complete, then flash highlight
  waitForScrollEnd(() => {
    heading.classList.add("highlight-flash");
    setTimeout(() => heading.classList.remove("highlight-flash"), 1500);
  });
}

/**
 * Wait for scroll animation to complete
 */
function waitForScrollEnd(callback: () => void) {
  let scrollTimeout: number;
  let lastScrollY = window.scrollY;
  
  const checkScrollEnd = () => {
    if (window.scrollY === lastScrollY) {
      // Scroll has stopped
      callback();
    } else {
      // Still scrolling, check again
      lastScrollY = window.scrollY;
      scrollTimeout = window.setTimeout(checkScrollEnd, 50);
    }
  };
  
  // Start checking after a brief delay to let scroll begin
  scrollTimeout = window.setTimeout(checkScrollEnd, 100);
}

/**
 * Toggle TOC visibility
 */
function toggleTOC() {
  setTOCVisible(!tocVisible);
}

function setTOCVisible(visible: boolean) {
  tocVisible = visible;
  const toc = document.getElementById("md-toc");
  const backdrop = document.getElementById("md-toc-backdrop");
  
  if (toc) {
    toc.classList.toggle("visible", visible);
  }
  if (backdrop) {
    backdrop.classList.toggle("visible", visible);
  }
}

/**
 * Toggle theme
 */
function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("md-theme", next);
  
  // Update theme button icon
  const btn = document.getElementById("md-theme-btn");
  if (btn) {
    btn.textContent = next === "dark" ? "☀" : "🌙";
  }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ctrl+G - Toggle TOC
    if (e.ctrlKey && e.key === "g") {
      e.preventDefault();
      toggleTOC();
    }

    // Ctrl+T - Toggle theme
    if (e.ctrlKey && e.key === "t") {
      e.preventDefault();
      toggleTheme();
    }

    // Escape - Close TOC
    if (e.key === "Escape" && tocVisible) {
      e.preventDefault();
      setTOCVisible(false);
    }
  });
}

/**
 * Highlight code blocks using Shiki
 */
async function highlightCodeBlocks() {
  const codeBlocks = document.querySelectorAll("pre code[class*='language-']");
  if (codeBlocks.length === 0) return;

  try {
    const { createHighlighter } = await import("https://esm.sh/shiki@1.24.0");

    const highlighter = await createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: [
        "javascript",
        "typescript",
        "python",
        "rust",
        "go",
        "bash",
        "json",
        "yaml",
        "html",
        "css",
        "sql",
        "markdown",
        "php",
      ],
    });

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    for (const block of codeBlocks) {
      const code = block.textContent || "";
      const langClass = block.className.match(/language-(\w+)/);
      const lang = langClass ? langClass[1] : "text";

      try {
        const highlighted = highlighter.codeToHtml(code, {
          lang: lang,
          theme: isDark ? "github-dark" : "github-light",
        });

        const pre = block.parentElement;
        if (pre) {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = highlighted;
          pre.replaceWith(wrapper.firstElementChild!);
        }
      } catch {
        // Language not supported, skip
      }
    }
  } catch (error) {
    console.warn("MD: Failed to load syntax highlighter", error);
  }
}

/**
 * Render Mermaid diagrams
 */
async function renderMermaidDiagrams() {
  const mermaidBlocks = document.querySelectorAll("pre code.language-mermaid");
  if (mermaidBlocks.length === 0) return;

  try {
    const mermaid = await import("https://esm.sh/mermaid@11.4.0");
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    mermaid.default.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
    });

    let index = 0;
    for (const block of mermaidBlocks) {
      const code = block.textContent || "";
      const pre = block.parentElement;
      if (!pre) continue;

      try {
        const id = `mermaid-${index++}`;
        const { svg } = await mermaid.default.render(id, code);

        const wrapper = document.createElement("div");
        wrapper.className = "mermaid-diagram";
        wrapper.innerHTML = svg;
        pre.replaceWith(wrapper);
      } catch (error) {
        console.warn("MD: Failed to render mermaid diagram", error);
      }
    }
  } catch (error) {
    console.warn("MD: Failed to load mermaid", error);
  }
}

/**
 * Get filename from URL
 */
function getFilenameFromURL(): string {
  const path = window.location.pathname;
  const parts = path.split("/");
  return parts[parts.length - 1] || "Untitled.md";
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
main().catch(console.error);

// Listen for system theme changes
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!localStorage.getItem("md-theme")) {
    const theme = e.matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("md-theme-btn");
    if (btn) {
      btn.textContent = theme === "dark" ? "☀" : "🌙";
    }
  }
});
