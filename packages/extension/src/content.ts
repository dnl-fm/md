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
let showingRaw = false;
let rawMarkdown = "";
let fontSize = parseInt(localStorage.getItem("md-font-size") || "16", 10);

// Constants
const HEADER_HEIGHT = 48;
const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_DEFAULT = 16;

/**
 * Main entry point
 */
async function main() {
  if (!shouldRenderPage()) {
    return;
  }

  rawMarkdown = getRawMarkdown() || "";
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
              <div class="md-font-controls">
                <button class="md-btn md-btn-icon md-btn-small" id="md-font-decrease" title="Decrease font size">
                  −
                </button>
                <span class="md-font-size" id="md-font-size">${fontSize}</span>
                <button class="md-btn md-btn-icon md-btn-small" id="md-font-increase" title="Increase font size">
                  +
                </button>
              </div>
              <button class="md-btn md-btn-small" id="md-raw-btn" title="Toggle raw markdown (Ctrl+U)">
                RAW
              </button>
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

  // Apply theme and font size
  document.documentElement.setAttribute("data-theme", theme);
  applyFontSize();

  // Render TOC
  renderTOC();

  // Setup button handlers
  document.getElementById("md-toc-btn")?.addEventListener("click", toggleTOC);
  document.getElementById("md-toc-close")?.addEventListener("click", () => setTOCVisible(false));
  document.getElementById("md-toc-backdrop")?.addEventListener("click", () => setTOCVisible(false));
  document.getElementById("md-theme-btn")?.addEventListener("click", toggleTheme);
  document.getElementById("md-raw-btn")?.addEventListener("click", toggleRawView);
  document.getElementById("md-font-decrease")?.addEventListener("click", () => changeFontSize(-1));
  document.getElementById("md-font-increase")?.addEventListener("click", () => changeFontSize(1));
}

/**
 * Change font size
 */
function changeFontSize(delta: number) {
  fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, fontSize + delta));
  localStorage.setItem("md-font-size", String(fontSize));
  applyFontSize();
  updateFontSizeDisplay();
}

/**
 * Apply font size to content
 */
function applyFontSize() {
  const content = document.getElementById("md-content");
  if (content) {
    content.style.fontSize = `${fontSize}px`;
  }
}

/**
 * Update font size display
 */
function updateFontSizeDisplay() {
  const display = document.getElementById("md-font-size");
  if (display) {
    display.textContent = String(fontSize);
  }
}

/**
 * Toggle between rendered and raw markdown view
 */
function toggleRawView() {
  showingRaw = !showingRaw;
  
  const content = document.getElementById("md-content");
  const btn = document.getElementById("md-raw-btn");
  
  if (!content || !btn) return;
  
  if (showingRaw) {
    // Show raw markdown
    content.innerHTML = `<pre class="raw-markdown"><code>${escapeHtml(rawMarkdown)}</code></pre>`;
    btn.textContent = "PREVIEW";
    btn.classList.add("active");
  } else {
    // Show rendered markdown
    const html = md.render(rawMarkdown);
    content.innerHTML = `<div class="markdown-body">${html}</div>`;
    btn.textContent = "RAW";
    btn.classList.remove("active");
    
    // Re-add heading IDs and re-highlight code
    addHeadingIds();
    highlightCodeBlocks();
    renderMermaidDiagrams();
  }
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

    // Ctrl+U - Toggle raw view
    if (e.ctrlKey && e.key === "u") {
      e.preventDefault();
      toggleRawView();
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
