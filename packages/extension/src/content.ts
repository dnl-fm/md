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

// Constants
const VERSION = "0.1.0";
const CHANGELOG_URL = "https://raw.githubusercontent.com/dnl-fm/md/main/packages/extension/CHANGELOG.md";
const HEADER_HEIGHT = 48;
const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_DEFAULT = 16;

// State
let tocEntries: TOCEntry[] = [];
let tocVisible = false;
let helpVisible = false;
let showingRaw = false;
let rawMarkdown = "";
let fontSize = FONT_SIZE_DEFAULT;
let fullWidth = true;
let theme: "dark" | "light" = "dark";
let showReleaseNotification = false;

// Storage keys
const STORAGE_KEYS = {
  theme: "md-theme",
  fontSize: "md-font-size",
  fullWidth: "md-full-width",
  lastSeenVersion: "md-last-seen-version",
} as const;

/**
 * Load settings from chrome.storage.local
 */
async function loadSettings(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(Object.values(STORAGE_KEYS), (result) => {
      if (result[STORAGE_KEYS.theme] === "dark" || result[STORAGE_KEYS.theme] === "light") {
        theme = result[STORAGE_KEYS.theme];
      } else {
        // Default to system preference
        theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      
      if (typeof result[STORAGE_KEYS.fontSize] === "number") {
        fontSize = result[STORAGE_KEYS.fontSize];
      }
      
      if (typeof result[STORAGE_KEYS.fullWidth] === "boolean") {
        fullWidth = result[STORAGE_KEYS.fullWidth];
      }
      
      // Check if this is a new version
      const lastSeenVersion = result[STORAGE_KEYS.lastSeenVersion];
      if (lastSeenVersion !== VERSION) {
        showReleaseNotification = true;
      }
      
      resolve();
    });
  });
}

/**
 * Save a setting to chrome.storage.local
 */
function saveSetting(key: string, value: string | number | boolean): void {
  chrome.storage.local.set({ [key]: value });
}

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

  // Load settings from extension storage
  await loadSettings();

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

  // Setup ASCII diagrams (WASM)
  await renderAsciiDiagrams();
}

/**
 * Get current theme
 */
function getCurrentTheme(): "dark" | "light" {
  return theme;
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
      <link rel="icon" type="image/png" sizes="32x32" href="${chrome.runtime.getURL("icons/icon48.png")}">
      <link rel="icon" type="image/png" sizes="16x16" href="${chrome.runtime.getURL("icons/icon16.png")}">
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
            <button class="md-btn md-btn-icon ${fullWidth ? "active" : ""}" id="md-width-btn" title="Toggle full width">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8l4 4-4 4M6 8l-4 4 4 4M2 12h20"/>
              </svg>
            </button>
            <button class="md-btn md-btn-icon" id="md-raw-btn" title="Toggle raw markdown (Ctrl+U)">
              &lt;/&gt;
            </button>
          </div>
          <div class="md-sidebar-footer">
            <button class="md-btn md-btn-icon" id="md-font-increase" title="Increase font size">
              +
            </button>
            <button class="md-btn md-btn-icon" id="md-font-decrease" title="Decrease font size">
              −
            </button>
            <button class="md-btn md-btn-icon" id="md-theme-btn" title="Toggle theme (Ctrl+T)">
              ${theme === "dark" ? "☀" : "🌙"}
            </button>
            <button class="md-btn md-btn-icon" id="md-help-btn" title="Help (Ctrl+H)">
              ?
            </button>
          </div>
        </aside>

        <!-- Main content -->
        <main class="md-main-content">
          <div class="md-file-header">
            <span class="md-file-path">📄 ${escapeHtml(filename)}</span>
            <div class="md-file-header-right">
              <button class="md-btn md-header-btn" id="md-print-btn" title="Print / PDF (Ctrl+P)">Print</button>
              <span class="md-file-meta">${formatFileSize(rawMarkdown.length)}</span>
            </div>
          </div>
          <div class="md-content" id="md-content">
            <div class="markdown-body">
              ${html}
            </div>
          </div>
        </main>

        <!-- Help Modal -->
        <div class="md-modal-backdrop" id="md-help-backdrop">
          <div class="md-modal">
            <div class="md-modal-header">
              <span>Help</span>
              <button class="md-btn md-modal-close" id="md-help-close">×</button>
            </div>
            <div class="md-modal-body">
              <div class="md-version-box">
                <strong>MD Extension</strong> — 0.1.0
              </div>
              
              <h3>Keyboard Shortcuts</h3>
              
              <div class="md-shortcuts-section">
                <h4>VIEW</h4>
                <div class="md-shortcuts-grid">
                  <div class="md-shortcut"><kbd>Ctrl+G</kbd> Table of contents</div>
                  <div class="md-shortcut"><kbd>Ctrl+T</kbd> Toggle theme</div>
                  <div class="md-shortcut"><kbd>Ctrl+U</kbd> Toggle raw markdown</div>
                  <div class="md-shortcut"><kbd>Ctrl+P</kbd> Print / PDF</div>
                  <div class="md-shortcut"><kbd>Ctrl+H</kbd> Help</div>
                  <div class="md-shortcut"><kbd>Esc</kbd> Close panel</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TOC Panel -->
        <div class="md-toc-backdrop" id="md-toc-backdrop"></div>
        <aside class="md-toc" id="md-toc">
          <div class="md-toc-header">
            <span>Table of Contents</span>
            <button class="md-btn md-toc-close" id="md-toc-close">×</button>
          </div>
          <nav class="md-toc-nav" id="md-toc-nav"></nav>
        </aside>

        <!-- Release Notification -->
        ${showReleaseNotification ? `
        <div class="release-notification" id="release-notification">
          <div class="release-notification-content">
            <div class="release-notification-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div class="release-notification-text">
              <div class="release-notification-title">New Release ${VERSION}</div>
            </div>
            <button class="release-notification-close" id="release-close" title="Dismiss">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <button class="release-notification-btn" id="release-changelog">View Changelog</button>
        </div>
        ` : ''}
      </div>
    </body>
  `;

  // Apply theme, font size and width
  document.documentElement.setAttribute("data-theme", theme);
  applyFontSize();
  applyFullWidth();

  // Render TOC
  renderTOC();

  // Setup button handlers
  document.getElementById("md-toc-btn")?.addEventListener("click", toggleTOC);
  document.getElementById("md-toc-close")?.addEventListener("click", () => setTOCVisible(false));
  document.getElementById("md-toc-backdrop")?.addEventListener("click", () => setTOCVisible(false));
  document.getElementById("md-theme-btn")?.addEventListener("click", toggleTheme);
  document.getElementById("md-raw-btn")?.addEventListener("click", toggleRawView);
  document.getElementById("md-width-btn")?.addEventListener("click", toggleFullWidth);
  document.getElementById("md-font-decrease")?.addEventListener("click", () => changeFontSize(-1));
  document.getElementById("md-font-increase")?.addEventListener("click", () => changeFontSize(1));
  document.getElementById("md-help-btn")?.addEventListener("click", toggleHelp);
  document.getElementById("md-help-close")?.addEventListener("click", () => setHelpVisible(false));
  document.getElementById("md-help-backdrop")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) setHelpVisible(false);
  });
  document.getElementById("md-print-btn")?.addEventListener("click", printDocument);
  document.getElementById("release-close")?.addEventListener("click", dismissReleaseNotification);
  document.getElementById("release-changelog")?.addEventListener("click", viewChangelog);
}

/**
 * Toggle full width mode
 */
function toggleFullWidth() {
  fullWidth = !fullWidth;
  saveSetting(STORAGE_KEYS.fullWidth, fullWidth);
  applyFullWidth();
  
  const btn = document.getElementById("md-width-btn");
  if (btn) {
    btn.classList.toggle("active", fullWidth);
  }
}

/**
 * Apply full width setting
 */
function applyFullWidth() {
  document.documentElement.classList.toggle("full-width", fullWidth);
}

/**
 * Change font size
 */
function changeFontSize(delta: number) {
  fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, fontSize + delta));
  saveSetting(STORAGE_KEYS.fontSize, fontSize);
  applyFontSize();
}

/**
 * Apply font size to content
 */
function applyFontSize() {
  document.documentElement.style.setProperty("--md-font-size", `${fontSize}px`);
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
    btn.classList.add("active");
  } else {
    // Show rendered markdown
    const html = md.render(rawMarkdown);
    content.innerHTML = `<div class="markdown-body">${html}</div>`;
    btn.classList.remove("active");
    
    // Re-add heading IDs and re-highlight code
    addHeadingIds();
    highlightCodeBlocks();
    renderMermaidDiagrams();
    renderAsciiDiagrams();
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
  const btn = document.getElementById("md-toc-btn");
  
  if (toc) {
    toc.classList.toggle("visible", visible);
  }
  if (backdrop) {
    backdrop.classList.toggle("visible", visible);
  }
  if (btn) {
    btn.classList.toggle("active", visible);
  }
}

/**
 * Toggle help modal
 */
/**
 * Print document
 */
function printDocument() {
  window.print();
}

/**
 * Dismiss release notification and save version
 */
function dismissReleaseNotification() {
  const notification = document.getElementById("release-notification");
  if (notification) {
    notification.classList.add("leaving");
    setTimeout(() => {
      notification.remove();
      saveSetting(STORAGE_KEYS.lastSeenVersion, VERSION);
    }, 200);
  }
}

/**
 * Open changelog and dismiss notification
 */
function viewChangelog() {
  window.open(CHANGELOG_URL, "_blank");
  dismissReleaseNotification();
}

function toggleHelp() {
  setHelpVisible(!helpVisible);
}

function setHelpVisible(visible: boolean) {
  helpVisible = visible;
  const backdrop = document.getElementById("md-help-backdrop");
  const btn = document.getElementById("md-help-btn");
  
  if (backdrop) {
    backdrop.classList.toggle("visible", visible);
  }
  if (btn) {
    btn.classList.toggle("active", visible);
  }
}

/**
 * Toggle theme
 */
function toggleTheme() {
  const root = document.documentElement;
  theme = theme === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", theme);
  saveSetting(STORAGE_KEYS.theme, theme);
  
  // Update theme button icon
  const btn = document.getElementById("md-theme-btn");
  if (btn) {
    btn.textContent = theme === "dark" ? "☀" : "🌙";
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

    // Ctrl+P - Print
    if (e.ctrlKey && e.key === "p") {
      e.preventDefault();
      printDocument();
    }

    // Ctrl+H - Toggle help
    if (e.ctrlKey && e.key === "h") {
      e.preventDefault();
      toggleHelp();
    }

    // Escape - Close panels
    if (e.key === "Escape") {
      if (helpVisible) {
        e.preventDefault();
        setHelpVisible(false);
      } else if (tocVisible) {
        e.preventDefault();
        setTOCVisible(false);
      }
    }
  });
}

/**
 * Highlight code blocks using Prism.js
 */
async function highlightCodeBlocks() {
  const codeBlocks = document.querySelectorAll("pre code[class*='language-']");
  if (codeBlocks.length === 0) return;

  try {
    // Import Prism core and needed languages
    const Prism = await import("prismjs");
    
    // Import language definitions (in dependency order)
    await import("prismjs/components/prism-javascript");
    await import("prismjs/components/prism-typescript");
    await import("prismjs/components/prism-jsx");
    await import("prismjs/components/prism-tsx");
    await import("prismjs/components/prism-python");
    await import("prismjs/components/prism-rust");
    await import("prismjs/components/prism-go");
    await import("prismjs/components/prism-php");
    await import("prismjs/components/prism-bash");
    await import("prismjs/components/prism-json");
    await import("prismjs/components/prism-yaml");
    await import("prismjs/components/prism-toml");
    await import("prismjs/components/prism-markup"); // html/xml
    await import("prismjs/components/prism-css");
    await import("prismjs/components/prism-sql");
    await import("prismjs/components/prism-markdown");
    await import("prismjs/components/prism-diff");

    for (const block of codeBlocks) {
      const code = block.textContent || "";
      const langClass = block.className.match(/language-(\w+)/);
      let lang = langClass ? langClass[1] : "text";

      // Map common aliases
      if (lang === "js") lang = "javascript";
      if (lang === "ts") lang = "typescript";
      if (lang === "html" || lang === "xml") lang = "markup";
      if (lang === "sh" || lang === "shell") lang = "bash";
      if (lang === "yml") lang = "yaml";

      // Check if language is supported
      if (!Prism.default.languages[lang]) {
        continue; // Skip unsupported languages
      }

      try {
        const highlighted = Prism.default.highlight(
          code,
          Prism.default.languages[lang],
          lang
        );

        block.innerHTML = highlighted;
        block.classList.add("language-" + lang);
      } catch (error) {
        console.warn(`MD: Failed to highlight ${lang} code block`, error);
      }
    }
  } catch (error) {
    console.warn("MD: Failed to load Prism.js", error);
  }
}

/**
 * Render Mermaid diagrams via API
 */
async function renderMermaidDiagrams() {
  const mermaidBlocks = document.querySelectorAll("pre code.language-mermaid");
  if (mermaidBlocks.length === 0) return;

  const { renderMermaid } = await import("./api");
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const theme = isDark ? "dark" : "light";

  for (const block of mermaidBlocks) {
    const code = block.textContent || "";
    const pre = block.parentElement;
    if (!pre) continue;

    // Add loading state
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "mermaid-loading";
    loadingDiv.textContent = "Loading diagram...";
    pre.replaceWith(loadingDiv);

    try {
      const svg = await renderMermaid(code, theme);
      
      if (svg) {
        const wrapper = document.createElement("div");
        wrapper.className = "mermaid-diagram";
        wrapper.innerHTML = svg;
        loadingDiv.replaceWith(wrapper);
      } else {
        // Fallback to raw code on error
        const fallback = document.createElement("pre");
        fallback.innerHTML = `<code class="language-mermaid">${escapeHtml(code)}</code>`;
        loadingDiv.replaceWith(fallback);
      }
    } catch (error) {
      console.warn("MD: Failed to render mermaid diagram", error);
      // Fallback to raw code
      const fallback = document.createElement("pre");
      fallback.innerHTML = `<code class="language-mermaid">${escapeHtml(code)}</code>`;
      loadingDiv.replaceWith(fallback);
    }
  }
}

/**
 * Render ASCII diagrams via API
 */
async function renderAsciiDiagrams() {
  const asciiBlocks = document.querySelectorAll("pre code.language-ascii");
  if (asciiBlocks.length === 0) return;

  const { renderASCII } = await import("./api");

  for (const block of asciiBlocks) {
    const code = block.textContent || "";
    const pre = block.parentElement;
    if (!pre) continue;

    // Add loading state
    const loadingPre = document.createElement("pre");
    loadingPre.className = "ascii-loading";
    loadingPre.textContent = "Loading diagram...";
    pre.replaceWith(loadingPre);

    try {
      const result = await renderASCII(code);
      
      if (result) {
        const wrapper = document.createElement("pre");
        wrapper.className = "ascii-diagram";
        wrapper.textContent = result;
        loadingPre.replaceWith(wrapper);
      } else {
        // Fallback to raw code on error
        const fallback = document.createElement("pre");
        fallback.innerHTML = `<code class="language-ascii">${escapeHtml(code)}</code>`;
        loadingPre.replaceWith(fallback);
      }
    } catch (error) {
      console.warn("MD: Failed to render ASCII diagram", error);
      // Fallback to raw code
      const fallback = document.createElement("pre");
      fallback.innerHTML = `<code class="language-ascii">${escapeHtml(code)}</code>`;
      loadingPre.replaceWith(fallback);
    }
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

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Initialize on load
main().catch(console.error);

// Listen for system theme changes (only if user hasn't set a preference)
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  chrome.storage.local.get(STORAGE_KEYS.theme, (result) => {
    if (!result[STORAGE_KEYS.theme]) {
      theme = e.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      const btn = document.getElementById("md-theme-btn");
      if (btn) {
        btn.textContent = theme === "dark" ? "☀" : "🌙";
      }
    }
  });
});
