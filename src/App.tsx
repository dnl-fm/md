import { createEffect, createSignal, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { confirm } from "./components/confirm-dialog";
import { Marked } from "marked";
import { createHighlighter, type Highlighter } from "shiki";

import "./styles/theme.css";
import "./styles/markdown.css";

import type { AppConfig, FileInfo } from "./types";
import {
  config,
  setConfig,
  setDarkColors,
  setLightColors,
  applyThemeColors,
  toggleTheme,
  currentFile,
  setCurrentFile,
  content,
  setContent,
  originalContent,
  setOriginalContent,
  setRenderedHtml,
  setFileInfo,
  setIsReadOnly,
  isReadOnly,
  isDirty,
  sidebarCollapsed,
  setSidebarCollapsed,
  setSidebarWidth,
  isResizing,
  uiFontSize,
  setUiFontSize,
  markdownFontSize,
  setMarkdownFontSize,
  uiFontFamily,
  setUiFontFamily,
  setMarkdownFontFamily,
  showSettings,
  setShowSettings,
  showHelp,
  setShowHelp,
  showRawMarkdown,
  setShowRawMarkdown,
  showSearch,
  setShowSearch,
  setSearchQuery,
  showLineNumbers,
  setShowLineNumbers,
  drafts,
  currentDraftId,
  setCurrentDraftId,
  createDraft,
  updateDraft,
  removeDraft,
  getDraft,
} from "./stores/app-store";
import {
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  getFontFamilyCSS,
  escapeHtml,
  normalizeMarkdown,
  slugify,
  clamp,
} from "./utils";

import { Sidebar } from "./components/sidebar";
import { FileHeader } from "./components/file-header";
import { MarkdownViewer } from "./components/markdown-viewer";
import { SettingsModal } from "./components/settings-modal";
import { ConfirmDialog } from "./components/confirm-dialog";
import { WelcomeModal } from "./components/welcome-modal";
import { HelpModal } from "./components/help-modal";
import { ReleaseNotification } from "./components/release-notification";

// Initialize marked
const marked = new Marked();

// Highlighter instance (module-level for effects)
let highlighter: Highlighter | null = null;

function App() {
  const [showWelcome, setShowWelcome] = createSignal(false);
  const [showReleaseNotification, setShowReleaseNotification] = createSignal(false);
  const [appVersion, setAppVersion] = createSignal("");

  // Initialize highlighter and config
  onMount(async () => {
    try {
      logger.info("App initializing...");
      highlighter = await createHighlighter({
        themes: ["github-dark", "github-light"],
        langs: [
          "javascript",
          "typescript",
          "python",
          "rust",
          "go",
          "java",
          "c",
          "cpp",
          "csharp",
          "php",
          "ruby",
          "swift",
          "kotlin",
          "sql",
          "html",
          "css",
          "json",
          "yaml",
          "toml",
          "markdown",
          "bash",
          "shell",
          "dockerfile",
          "plaintext",
        ],
      });

      // Load config
      const cfg = await invoke<AppConfig>("get_config");
      setConfig(cfg);
      setSidebarCollapsed(cfg.sidebar_collapsed);
      setSidebarWidth(cfg.sidebar_width || 220);
      setUiFontSize(cfg.ui_font_size || 14);
      setMarkdownFontSize(cfg.markdown_font_size || 14);
      setUiFontFamily(cfg.ui_font_family || "system");
      setMarkdownFontFamily(cfg.markdown_font_family || "JetBrains Mono");
      setDarkColors({ ...DEFAULT_DARK_COLORS, ...cfg.dark_colors });
      setLightColors({ ...DEFAULT_LIGHT_COLORS, ...cfg.light_colors });
      document.documentElement.setAttribute("data-theme", cfg.theme);
      // Sync light class with theme for index.html styles
      if (cfg.theme === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
      localStorage.setItem("theme", cfg.theme);
      applyThemeColors();

      // Show welcome modal if first run (or ?welcome=1 in dev)
      const urlParams = new URLSearchParams(window.location.search);
      if (!cfg.onboarding_complete || urlParams.get("welcome") === "1") {
        setShowWelcome(true);
      }

      // Check for new version notification
      const version = await invoke<string>("get_app_version");
      setAppVersion(version);
      if (cfg.onboarding_complete && cfg.last_seen_version !== version) {
        setShowReleaseNotification(true);
      }

      // Keyboard shortcuts
      document.addEventListener("keydown", handleKeyDown);

      // Check for initial file from CLI first
      const initialFile = await invoke<string | null>("get_initial_file");
      if (initialFile) {
        await loadFile(initialFile);
      } else if (cfg.history.length > 0) {
        await loadMostRecentFile(cfg.history);
      }

      // Listen for file changes
      await listen<string>("file-changed", (event) => {
        setContent(event.payload);
        setOriginalContent(event.payload);
      });

      // Listen for file opened from another instance (single-instance)
      await listen<string>("open-file", (event) => {
        logger.info(`Opening file from second instance: ${event.payload}`);
        loadFile(event.payload);
      });
    } catch (err) {
      logger.error(`Failed to initialize app: ${err}`);
    } finally {
      logger.info("App ready, hiding splash");
      
      // Always hide splash screen
      (window as any).hideSplash?.();
    }
  });

  // Render markdown when content changes
  createEffect(async () => {
    const md = content();

    if (!md) {
      setRenderedHtml("");
      return;
    }

    const theme = config().theme === "dark" ? "github-dark" : "github-light";

    marked.setOptions({
      gfm: true,
      breaks: false,
    });

    const renderer = {
      code({ text, lang }: { text: string; lang?: string }): string {
        const language = lang || "plaintext";
        if (highlighter) {
          try {
            const highlighted = highlighter.codeToHtml(text, { lang: language, theme });
            return `<div class="code-block-wrapper">${lang ? `<span class="code-block-lang">${lang}</span>` : ""}${highlighted}</div>`;
          } catch {
            return `<pre><code>${escapeHtml(text)}</code></pre>`;
          }
        }
        return `<pre><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
      },
      heading({ tokens, depth }: { tokens: { raw: string }[]; depth: number }): string {
        const text = tokens.map((t) => t.raw).join("");
        const slug = slugify(text);
        return `<h${depth} id="${slug}">${text}</h${depth}>`;
      },
    };

    marked.use({ renderer });

    const html = await marked.parse(normalizeMarkdown(md));
    setRenderedHtml(html);
  });

  // Load most recent file that exists (last in list = most recently opened)
  async function loadMostRecentFile(history: string[]) {
    for (const path of [...history].reverse()) {
      try {
        const exists = await invoke<boolean>("file_exists", { path });
        if (exists) {
          await loadFile(path, false);
          return;
        } else {
          await invoke("remove_from_history", { path });
        }
      } catch {
        await invoke("remove_from_history", { path });
      }
    }
    const cfg = await invoke<AppConfig>("get_config");
    setConfig(cfg);
  }

  // Keyboard shortcut handler
  async function handleKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case "n":
          e.preventDefault();
          newFile();
          break;
        case "o":
          e.preventDefault();
          openFileDialog();
          break;
        case "w":
          e.preventDefault();
          closeFile();
          break;
        case "t":
          e.preventDefault();
          toggleTheme();
          break;
        case "b":
          e.preventDefault();
          toggleSidebar();
          break;
        case ",":
          e.preventDefault();
          if (!showSettings()) {
            setShowHelp(false);
          }
          setShowSettings(!showSettings());
          break;
        case "h":
          e.preventDefault();
          if (!showHelp()) {
            setShowSettings(false);
          }
          setShowHelp(!showHelp());
          break;
        case "=":
        case "+":
          e.preventDefault();
          changeFontSize(1);
          break;
        case "-":
          e.preventDefault();
          changeFontSize(-1);
          break;
        case "0":
          e.preventDefault();
          changeFontSize(0);
          break;
        case " ":
          e.preventDefault();
          if (!isReadOnly()) {
            setShowRawMarkdown(!showRawMarkdown());
          }
          break;
        case "e":
          e.preventDefault();
          if (!isDirty() && !isReadOnly()) {
            setShowRawMarkdown(!showRawMarkdown());
          }
          break;
        case "f": {
          e.preventDefault();
          if (!showRawMarkdown()) {
            const willOpen = !showSearch();
            setShowSearch(willOpen);
            if (willOpen) {
              setSearchQuery("");
            }
          }
          break;
        }
        case "l":
          e.preventDefault();
          setShowLineNumbers(!showLineNumbers());
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9": {
          e.preventDefault();
          const index = parseInt(e.key) - 1;
          const history = config().history;
          const draftList = drafts();
          if (index < history.length) {
            loadFile(history[index], false);
          } else if (index < history.length + draftList.length) {
            loadDraft(draftList[index - history.length].id);
          }
          break;
        }
        case "[":
        case "]": {
          e.preventDefault();
          const history = config().history;
          const draftList = drafts();
          const totalItems = history.length + draftList.length;
          if (totalItems === 0) break;
          
          // Find current index
          const file = currentFile();
          const draftId = currentDraftId();
          let currentIndex = -1;
          if (file) {
            currentIndex = history.indexOf(file);
          } else if (draftId) {
            const draftIndex = draftList.findIndex(d => d.id === draftId);
            if (draftIndex !== -1) currentIndex = history.length + draftIndex;
          }
          
          // Calculate next/previous with wrap-around
          let newIndex: number;
          if (e.key === "]") {
            // Next
            newIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % totalItems;
          } else {
            // Previous
            newIndex = currentIndex === -1 ? totalItems - 1 : (currentIndex - 1 + totalItems) % totalItems;
          }
          
          // Load the item
          if (newIndex < history.length) {
            loadFile(history[newIndex], false);
          } else {
            loadDraft(draftList[newIndex - history.length].id);
          }
          break;
        }
      }
    }
    if (e.key === "Escape") {
      if (showSearch()) {
        setShowSearch(false);
        setSearchQuery("");
      } else if (showSettings()) {
        setShowSettings(false);
      } else if (showHelp()) {
        setShowHelp(false);
      } else if (showRawMarkdown()) {
        setContent(originalContent());
        setShowRawMarkdown(false);
      }
    }
  }

  // Toggle sidebar
  async function toggleSidebar() {
    const collapsed = !sidebarCollapsed();
    setSidebarCollapsed(collapsed);
    const newConfig = { ...config(), sidebar_collapsed: collapsed };
    setConfig(newConfig);
    await invoke("save_config", { config: newConfig });
  }

  // Change both UI and markdown font sizes together
  async function changeFontSize(delta: number) {
    const newUiSize = delta === 0 ? 14 : clamp(uiFontSize() + delta, 10, 20);
    const newMarkdownSize = delta === 0 ? 14 : clamp(markdownFontSize() + delta, 10, 24);
    setUiFontSize(newUiSize);
    setMarkdownFontSize(newMarkdownSize);
    const newConfig = { 
      ...config(), 
      ui_font_size: newUiSize,
      markdown_font_size: newMarkdownSize 
    };
    setConfig(newConfig);
    await invoke("save_config", { config: newConfig });
  }

  // Refocus the editor textarea (used after dialogs)
  function focusEditor() {
    const textarea = document.querySelector(".markdown-editor") as HTMLTextAreaElement;
    textarea?.focus();
  }

  // Create new untitled file
  async function newFile() {
    // Check for unsaved changes in current file
    const dirty = isDirty();
    const currentDraft = currentDraftId();
    
    if (dirty) {
      const shouldSwitch = await confirm(
        "You have unsaved changes that will be lost.",
        {
          title: "Unsaved Changes",
          confirmLabel: "Discard",
          cancelLabel: "Stay",
        }
      );
      if (!shouldSwitch) {
        focusEditor();
        return;
      }
      
      // If discarding a draft with content, remove it entirely
      if (currentDraft && content().trim()) {
        removeDraft(currentDraft);
      }
    } else if (currentDraft) {
      // Not dirty but has draft - save current content before creating new
      updateDraft(currentDraft, content());
    }
    
    const id = createDraft();
    setCurrentFile(null);
    setCurrentDraftId(id);
    setContent("");
    setOriginalContent("");
    setRenderedHtml("");
    setFileInfo(null);
    setShowRawMarkdown(true);
  }

  // Switch to a draft
  async function loadDraft(id: string) {
    // Don't reload the same draft
    if (currentDraftId() === id) return;
    
    // Check for unsaved changes in current file
    const dirty = isDirty();
    const currentDraft = currentDraftId();
    
    if (dirty) {
      const shouldSwitch = await confirm(
        "You have unsaved changes that will be lost.",
        {
          title: "Unsaved Changes",
          confirmLabel: "Discard",
          cancelLabel: "Stay",
        }
      );
      if (!shouldSwitch) {
        focusEditor();
        return;
      }
      
      // If discarding a draft with content, remove it entirely
      if (currentDraft && content().trim()) {
        removeDraft(currentDraft);
      }
    } else if (currentDraft && currentDraft !== id) {
      // Not dirty but has draft - save current content before switching
      updateDraft(currentDraft, content());
    }
    
    const draft = getDraft(id);
    if (draft) {
      setCurrentFile(null);
      setCurrentDraftId(id);
      setContent(draft.content);
      setOriginalContent(draft.content);
      setRenderedHtml("");
      setFileInfo(null);
      setShowRawMarkdown(true);
    }
  }

  // Save file and return to preview
  async function saveAndPreview() {
    const file = currentFile();
    if (file && isDirty()) {
      // Save existing file
      await invoke("write_file", { path: file, content: content() });
      setOriginalContent(content());
    }
    // For drafts, just toggle to preview (no auto-save dialog)
    setShowRawMarkdown(false);
  }

  // Save draft to file (with dialog)
  async function saveDraftToFile() {
    const draftId = currentDraftId();
    if (!draftId) return;
    
    const path = await save({
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (path) {
      await invoke("write_file", { path, content: content() });
      removeDraft(draftId);
      // Mark as clean before loading to avoid dirty check
      setOriginalContent(content());
      await loadFile(path, true);
    }
  }

  // View changelog from help modal
  async function viewChangelogFromHelp() {
    try {
      const changelogPath = await invoke<string>("get_changelog_path");
      setShowHelp(false);
      await loadFile(changelogPath);
    } catch (err) {
      console.error("Failed to load changelog:", err);
    }
  }

  // Load a file
  async function loadFile(path: string, addToHistory: boolean = true) {
    // Don't reload the same file
    if (currentFile() === path) return;
    
    // Check for unsaved changes in current file
    const dirty = isDirty();
    const draftId = currentDraftId();
    
    if (dirty) {
      const shouldSwitch = await confirm(
        "You have unsaved changes that will be lost.",
        {
          title: "Unsaved Changes",
          confirmLabel: "Discard",
          cancelLabel: "Stay",
        }
      );
      if (!shouldSwitch) {
        focusEditor();
        return;
      }
      
      // If discarding a draft with content, remove it entirely
      if (draftId && content().trim()) {
        removeDraft(draftId);
      }
    } else if (draftId) {
      // Not dirty but has draft - save current content before switching
      updateDraft(draftId, content());
    }
    
    try {
      
      const fileContent = await invoke<string>("read_file", { path });
      setContent(fileContent);
      setOriginalContent(fileContent);
      setCurrentFile(path);
      setCurrentDraftId(null);
      setShowRawMarkdown(false);
      
      // Mark bundled changelog as read-only (in resource dir or dev src-tauri parent)
      const changelogPath = await invoke<string>("get_changelog_path").catch(() => null);
      setIsReadOnly(changelogPath !== null && path === changelogPath);

      const info = await invoke<FileInfo>("get_file_info", { path });
      setFileInfo(info);

      if (addToHistory && !config().history.includes(path)) {
        await invoke("add_to_history", { path });
        const cfg = await invoke<AppConfig>("get_config");
        setConfig(cfg);
      }

      await invoke("watch_file", { path });
    } catch (e) {
      console.error("Failed to load file:", e);
    }
  }

  // Open file dialog
  let isDialogOpen = false;
  async function openFileDialog() {
    if (isDialogOpen) return;
    isDialogOpen = true;
    
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Markdown", extensions: ["md", "markdown", "mkd"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (selected) {
        await loadFile(selected);
      }
    } finally {
      isDialogOpen = false;
    }
  }

  // Close current file
  async function closeFile() {
    const file = currentFile();
    const draftId = currentDraftId();
    
    // Handle closing a draft
    if (draftId) {
      // Check current content (not stored draft content, as it may not be synced)
      if (content().trim()) {
        const shouldClose = await confirm(
          "This draft has content that will be lost.",
          {
            title: "Unsaved Draft",
            confirmLabel: "Discard",
            cancelLabel: "Keep",
          }
        );
        if (!shouldClose) return;
      }
      
      const draftList = drafts();
      const closedIndex = draftList.findIndex(d => d.id === draftId);
      removeDraft(draftId);
      
      // Select next tab: prefer file from history, then another draft
      const history = config().history;
      const remainingDrafts = draftList.filter(d => d.id !== draftId);
      
      if (remainingDrafts.length > 0) {
        const nextIndex = closedIndex < remainingDrafts.length ? closedIndex : remainingDrafts.length - 1;
        loadDraft(remainingDrafts[nextIndex].id);
        return;
      } else if (history.length > 0) {
        await loadFile(history[history.length - 1], false);
        return;
      }
    }
    
    // Handle closing a file from history
    if (file) {
      // Check for unsaved changes
      if (isDirty()) {
        const shouldClose = await confirm(
          "You have unsaved changes that will be lost.",
          {
            title: "Unsaved Changes",
            confirmLabel: "Discard",
            cancelLabel: "Keep",
          }
        );
        if (!shouldClose) return;
      }
      
      const history = config().history;
      const closedIndex = history.indexOf(file);
      
      // Remove from history
      const newHistory = history.filter((p) => p !== file);
      const newConfig = { ...config(), history: newHistory };
      setConfig(newConfig);
      await invoke("save_config", { config: newConfig });
      
      // Stay at same position (select file below), or last file if closing last one
      if (newHistory.length > 0) {
        const nextIndex = closedIndex < newHistory.length ? closedIndex : newHistory.length - 1;
        await loadFile(newHistory[nextIndex], false);
        return;
      }
      
      // No more files, check for drafts
      const draftList = drafts();
      if (draftList.length > 0) {
        loadDraft(draftList[draftList.length - 1].id);
        return;
      }
    }
    
    setCurrentFile(null);
    setCurrentDraftId(null);
    setContent("");
    setOriginalContent("");
    setRenderedHtml("");
    setFileInfo(null);
    setShowRawMarkdown(false);
  }

  return (
    <div
      class={`app-container ${isResizing() ? "resizing" : ""}`}
      style={{
        "font-size": `${uiFontSize()}px`,
        "font-family": getFontFamilyCSS(uiFontFamily()),
      }}
    >
      <Sidebar onOpenFile={openFileDialog} onLoadFile={loadFile} onLoadDraft={loadDraft} />

      <main class="main-content">
        <FileHeader onSaveAndPreview={saveAndPreview} onSaveDraft={saveDraftToFile} />
        <MarkdownViewer onSaveAndPreview={saveAndPreview} onSaveDraft={saveDraftToFile} />
      </main>

      <SettingsModal />
      <WelcomeModal show={showWelcome()} onComplete={() => setShowWelcome(false)} />
      <HelpModal 
        show={showHelp()} 
        version={appVersion()} 
        onClose={() => setShowHelp(false)}
        onViewChangelog={viewChangelogFromHelp}
      />
      <ConfirmDialog />
      {showReleaseNotification() && (
        <ReleaseNotification 
          version={appVersion()} 
          onDismiss={() => setShowReleaseNotification(false)}
          onLoadFile={loadFile}
        />
      )}
    </div>
  );
}

export default App;
