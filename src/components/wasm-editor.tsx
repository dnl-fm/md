/**
 * WASM-based Markdown Editor Component
 *
 * Uses Rust/WASM for:
 * - Text buffer management (ropey) - O(log n) edits
 * - Syntax highlighting
 * - Cursor/selection management
 * - Undo/redo
 *
 * Direct keyboard handling - no hidden textarea as source of truth.
 */
import {
  Show,
  createSignal,
  onMount,
  onCleanup,
  For,
  createEffect,
  batch,
} from "solid-js";
import {
  content,
  setContent,
  showLineNumbers,
  markdownFontSize,
  markdownFontFamily,
  currentDraftId,
  currentFile,
  scrollAnchor,
  setScrollAnchor,
} from "../stores/app-store";
import { getFontFamilyCSS } from "../utils";

// WASM module - loaded dynamically
let wasm: typeof import("../wasm-pkg/md_editor") | null = null;

interface Span {
  text: string;
  style: string;
}

interface HighlightedLine {
  num: number;
  spans: Span[];
}

/** API exposed by WasmEditor for parent to query state */
export interface WasmEditorApi {
  getTopVisibleLine: () => number;
}

interface WasmEditorProps {
  onSaveAndPreview: () => void;
  onSaveDraft?: () => void;
  onApi?: (api: WasmEditorApi) => void;
}

export function WasmEditor(props: WasmEditorProps) {
  let editorRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;
  let gutterRef: HTMLDivElement | undefined;

  const [isReady, setIsReady] = createSignal(false);
  const [lines, setLines] = createSignal<HighlightedLine[]>([]);
  const [cursorLine, setCursorLine] = createSignal(0);
  const [cursorCol, setCursorCol] = createSignal(0);

  const [scrollTop, setScrollTop] = createSignal(0);
  const [error, setError] = createSignal<string | null>(null);
  const [isFocused, setIsFocused] = createSignal(false);

  // Selection anchor - where selection started (doesn't change during shift+arrow)
  const [selectionAnchor, setSelectionAnchor] = createSignal<number | null>(
    null,
  );
  // Visual selection bounds for rendering
  const [selStart, setSelStart] = createSignal<number | null>(null);
  const [selEnd, setSelEnd] = createSignal<number | null>(null);

  // Track last loaded file/draft to detect changes
  let lastFileKey: string | null = null;

  // Cached document height - updated when content changes
  const [docHeight, setDocHeight] = createSignal(500);

  // Line metrics
  const LINE_HEIGHT = () => markdownFontSize() * 1.6;
  const CHAR_WIDTH = () => markdownFontSize() * 0.6;
  const VISIBLE_BUFFER = 10;
  const CONTENT_PADDING = 16; // Must match .wasm-content padding in CSS

  // Convert mouse event to line/col position
  function getLineColFromMouseEvent(e: MouseEvent): { line: number; col: number } | null {
    if (!contentRef || !wasm) return null;
    
    const rect = contentRef.getBoundingClientRect();
    const x = e.clientX - rect.left + contentRef.scrollLeft - CONTENT_PADDING;
    const y = e.clientY - rect.top + contentRef.scrollTop - CONTENT_PADDING;

    const clickedLine = Math.floor(y / LINE_HEIGHT());
    const clickedCol = Math.round(x / CHAR_WIDTH());

    const lineCount = wasm.line_count();
    const line = Math.max(0, Math.min(clickedLine, lineCount - 1));
    const lineContent = wasm.get_line(line);
    const maxCol = Math.max(0, lineContent.length - (lineContent.endsWith("\n") ? 1 : 0));
    const col = Math.max(0, Math.min(clickedCol, maxCol));

    return { line, col };
  }

  // Initialize WASM
  onMount(async () => {
    try {
      if (!wasm) {
        const mod = await import("../wasm-pkg/md_editor");
        await mod.default();
        wasm = mod;
      }

      // Initialize with current content
      const text = content();
      wasm.set_content(text);
      wasm.reset_highlighting_state();
      wasm.clear_undo_redo();
      wasm.set_cursor(0);

      // Track this file
      lastFileKey = getFileKey();

      setIsReady(true);

      // Wait for next frame to ensure DOM is ready
      requestAnimationFrame(() => {
        updateCursorDisplay();
        updateDocHeight(); // Set initial height
        updateVisibleLines();
        
        // Scroll to anchor if set (from preview mode)
        scrollToAnchor();

        // Auto-focus the editor
        editorRef?.focus();

        // Capture Shift+Tab before browser does (for reverse focus navigation)
        // Must use window-level capture to intercept before browser handles it
        const captureShiftTab = (e: KeyboardEvent) => {
          if (
            (e.key === "Tab" || e.code === "Tab") &&
            e.shiftKey &&
            isFocused()
          ) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            handleTabKey(true); // true = dedent
          }
        };
        window.addEventListener("keydown", captureShiftTab, { capture: true });
        cleanupShiftTab = () =>
          window.removeEventListener("keydown", captureShiftTab, {
            capture: true,
          });
        
        // Watch for container resize to update visible lines
        if (contentRef) {
          const resizeObserver = new ResizeObserver(() => {
            updateVisibleLines();
          });
          resizeObserver.observe(contentRef);
          cleanupResizeObserver = () => resizeObserver.disconnect();
        }
      });
    } catch (err) {
      console.error("WASM init error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load WASM module",
      );
    }
  });

  // Store cleanup function for Shift+Tab listener
  let cleanupShiftTab: (() => void) | null = null;
  
  // Store cleanup function for resize observer
  let cleanupResizeObserver: (() => void) | null = null;

  onCleanup(() => {
    if (cleanupShiftTab) cleanupShiftTab();
    if (cleanupResizeObserver) cleanupResizeObserver();
  });

  // Expose API for parent to query editor state (e.g., for scroll sync)
  function getTopVisibleLine(): number {
    if (!contentRef) return 0;
    const lineHeight = LINE_HEIGHT();
    return Math.floor(contentRef.scrollTop / lineHeight);
  }

  // Register API with parent
  props.onApi?.({ getTopVisibleLine });

  // Get unique key for current file/draft
  function getFileKey(): string {
    return currentDraftId() ?? currentFile() ?? "";
  }

  // Watch for file/draft changes (not content changes!)
  createEffect(() => {
    const fileKey = getFileKey();

    // Only reload if file actually changed
    if (isReady() && wasm && fileKey !== lastFileKey) {
      lastFileKey = fileKey;

      const text = content();
      wasm.set_content(text);
      wasm.reset_highlighting_state();
      wasm.clear_undo_redo();
      wasm.set_cursor(0);
      wasm.clear_selection();

      batch(() => {
        setSelectionAnchor(null);
        setSelStart(null);
        setSelEnd(null);
      });

      updateCursorDisplay();
      updateDocHeight(); // Update height for new content
      updateVisibleLines();
    }
  });

  // Update visible lines based on scroll position
  function updateVisibleLines() {
    if (!wasm || !contentRef) return;

    const viewportHeight = contentRef.clientHeight || 500;
    const lineHeight = LINE_HEIGHT();
    const scrollOffset = scrollTop();

    const startLine = Math.max(
      0,
      Math.floor(scrollOffset / lineHeight) - VISIBLE_BUFFER,
    );
    const visibleCount =
      Math.ceil(viewportHeight / lineHeight) + VISIBLE_BUFFER * 2;

    const highlighted = wasm.get_highlighted_lines(
      startLine,
      visibleCount,
    ) as HighlightedLine[];
    setLines(highlighted);
    // Don't update height on scroll - only on content changes
  }

  // Update cursor position display
  function updateCursorDisplay() {
    if (!wasm) return;
    const pos = wasm.get_cursor_position() as {
      line: number;
      col: number;
      offset: number;
    };
    batch(() => {
      setCursorLine(pos.line);
      setCursorCol(pos.col);
    });
  }

  // Scroll to keep cursor visible
  function scrollToCursor() {
    if (!contentRef || !wasm) return;

    const lineHeight = LINE_HEIGHT();
    const cursorY = cursorLine() * lineHeight;
    const viewportHeight = contentRef.clientHeight;
    const currentScroll = contentRef.scrollTop;

    if (cursorY < currentScroll) {
      contentRef.scrollTop = cursorY;
      setScrollTop(cursorY);
    } else if (cursorY + lineHeight > currentScroll + viewportHeight) {
      const newScroll = cursorY - viewportHeight + lineHeight;
      contentRef.scrollTop = newScroll;
      setScrollTop(newScroll);
    }
  }

  // Scroll to line number (used when switching from preview to edit)
  // Anchor is now a line number string from data-line attribute
  function scrollToAnchor() {
    const anchor = scrollAnchor();
    console.log('[scroll-sync][editor] anchor (line):', anchor);
    
    if (!anchor || !wasm || !contentRef) {
      console.log('[scroll-sync][editor] Missing:', { anchor: !!anchor, wasm: !!wasm, contentRef: !!contentRef });
      setScrollAnchor(null);
      return;
    }

    const targetLine = parseInt(anchor, 10);
    if (isNaN(targetLine)) {
      console.warn('[scroll-sync][editor] Invalid line number:', anchor);
      setScrollAnchor(null);
      return;
    }

    console.log('[scroll-sync][editor] scrolling to line:', targetLine);

    // Wait for editor layout to be ready
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        if (!contentRef || !wasm) return;
        
        const lineHeight = LINE_HEIGHT();
        const scrollY = Math.max(0, targetLine * lineHeight - 50);
        
        console.log('[scroll-sync][editor] scroll:', { 
          targetLine,
          targetScrollY: scrollY,
          scrollHeight: contentRef.scrollHeight
        });
        
        contentRef.scrollTop = scrollY;
        setScrollTop(scrollY);
        
        // Set cursor to start of the target line
        const lineStart = wasm.get_line_start(targetLine);
        wasm.set_cursor(lineStart);
        
        updateCursorDisplay();
        updateVisibleLines();
      });
    });

    // Clear the anchor
    setScrollAnchor(null);
  }

  // Sync content to store (and update height since content changed)
  function syncToStore() {
    if (!wasm) return;
    setContent(wasm.get_content());
    updateDocHeight();
  }

  // Handle scroll
  function handleScroll(e: Event) {
    const target = e.target as HTMLDivElement;
    const newScrollTop = target.scrollTop;

    // Sync gutter scroll
    if (gutterRef) {
      gutterRef.scrollTop = newScrollTop;
    }
    
    setScrollTop(newScrollTop);
    updateVisibleLines();
  }

  // Clear selection state
  function clearSelection() {
    if (!wasm) return;
    wasm.clear_selection();
    batch(() => {
      setSelectionAnchor(null);
      setSelStart(null);
      setSelEnd(null);
    });
  }

  // Update selection with anchor
  function updateSelection(anchor: number, cursor: number) {
    if (!wasm) return;
    const start = Math.min(anchor, cursor);
    const end = Math.max(anchor, cursor);

    wasm.set_selection(start, end);
    batch(() => {
      setSelectionAnchor(anchor);
      setSelStart(start);
      setSelEnd(end);
    });
  }

  // Delete selected text, returns true if there was selection
  function deleteSelection(): boolean {
    if (!wasm) return false;
    const start = selStart();
    const end = selEnd();

    if (start !== null && end !== null && start !== end) {
      wasm.delete_range(start, end);
      wasm.set_cursor(start);
      clearSelection();
      return true;
    }
    return false;
  }

  // Get selected text
  function getSelectedText(): string | null {
    if (!wasm) return null;
    const start = selStart();
    const end = selEnd();
    if (start === null || end === null || start === end) return null;
    return wasm.get_content().substring(start, end);
  }

  // Handle line prefix toggle (lists, blockquotes) for multi-line selection
  function handleLinePrefix(prefix: string): boolean {
    if (!wasm || !isReady()) return false;

    const start = selStart();
    const end = selEnd();
    const hasSelection = start !== null && end !== null && start !== end;

    if (!hasSelection) return false;

    wasm.save_undo_state();

    const text = wasm.get_content();
    const firstLineStart = text.lastIndexOf("\n", start - 1) + 1;

    // Don't include line if cursor is at its very beginning
    let adjustedEnd = end;
    if (end > 0 && text[end - 1] === "\n") {
      adjustedEnd = end - 1;
    }

    const lastLineEnd = text.indexOf("\n", adjustedEnd);
    const rangeEnd = lastLineEnd === -1 ? text.length : lastLineEnd;

    const selectedText = text.substring(firstLineStart, rangeEnd);
    const lines = selectedText.split("\n");

    // Check if all lines already have this prefix (for toggle)
    const prefixWithSpace = prefix + " ";
    const allHavePrefix = lines.every((line) =>
      line.startsWith(prefixWithSpace),
    );

    let newLines: string[];
    let deltaTotal = 0;

    if (allHavePrefix) {
      // Remove prefix from all lines
      newLines = lines.map((line) => {
        deltaTotal -= prefixWithSpace.length;
        return line.substring(prefixWithSpace.length);
      });
    } else {
      // Add prefix to all lines (remove existing list markers first)
      newLines = lines.map((line) => {
        // Remove existing list markers if present
        const trimmed = line.replace(/^(\s*)[-*+>]\s?/, "$1");
        const diff = line.length - trimmed.length;
        deltaTotal += prefixWithSpace.length - diff;
        return prefixWithSpace + trimmed;
      });
    }

    // Replace the text
    const newText = newLines.join("\n");
    const fullText =
      text.substring(0, firstLineStart) + newText + text.substring(rangeEnd);
    wasm.set_content(fullText);

    // Update selection
    const newEnd = Math.max(firstLineStart, end + deltaTotal);
    updateSelection(firstLineStart, newEnd);
    wasm.set_cursor(newEnd);

    updateCursorDisplay();
    updateVisibleLines();
    syncToStore();
    scrollToCursor();

    return true;
  }

  // Handle Tab/Shift+Tab (called from capture phase listener for Shift+Tab)
  function handleTabKey(dedent: boolean) {
    if (!wasm || !isReady()) return;

    wasm.save_undo_state();

    const start = selStart();
    const end = selEnd();
    const hasSelection = start !== null && end !== null && start !== end;

    if (hasSelection) {
      // Multi-line indent/dedent
      const text = wasm.get_content();
      const firstLineStart = text.lastIndexOf("\n", start - 1) + 1;

      // Don't include a line if cursor is at its very beginning (column 0)
      // Check if end is right after a newline (at start of a line)
      let adjustedEnd = end;
      if (end > 0 && text[end - 1] === "\n") {
        adjustedEnd = end - 1; // Move back to previous line
      }

      const lastLineEnd = text.indexOf("\n", adjustedEnd);
      const rangeEnd = lastLineEnd === -1 ? text.length : lastLineEnd;

      const selectedText = text.substring(firstLineStart, rangeEnd);
      const lines = selectedText.split("\n");

      let newLines: string[];
      let deltaFirst = 0;
      let deltaTotal = 0;

      if (dedent) {
        // Dedent: remove up to 2 spaces from each line
        newLines = lines.map((line, i) => {
          const spaces = line.startsWith("  ")
            ? 2
            : line.startsWith("\t")
              ? 1
              : line.startsWith(" ")
                ? 1
                : 0;
          if (i === 0) deltaFirst = -spaces;
          deltaTotal -= spaces;
          return line.substring(spaces);
        });
      } else {
        // Indent: add 2 spaces to each line
        newLines = lines.map((line, i) => {
          if (i === 0) deltaFirst = 2;
          deltaTotal += 2;
          return "  " + line;
        });
      }

      // Replace the text
      const newText = newLines.join("\n");
      const fullText =
        text.substring(0, firstLineStart) + newText + text.substring(rangeEnd);
      wasm.set_content(fullText);

      // Update selection
      const newStart = Math.max(firstLineStart, start + deltaFirst);
      const newEnd = Math.max(newStart, end + deltaTotal);
      updateSelection(newStart, newEnd);
      wasm.set_cursor(newEnd);
    } else if (dedent) {
      // Dedent single line
      clearSelection();
      const pos = wasm.get_cursor_position() as { line: number; col: number };
      const lineStart = wasm.get_line_start(pos.line);
      const text = wasm.get_content();

      let removed = 0;
      if (text.substring(lineStart, lineStart + 2) === "  ") {
        removed = 2;
      } else if (text[lineStart] === "\t" || text[lineStart] === " ") {
        removed = 1;
      }

      if (removed > 0) {
        wasm.replace_range(lineStart, lineStart + removed, "");
        const newCol = Math.max(0, pos.col - removed);
        wasm.set_cursor(lineStart + newCol);
      }
    } else {
      // Indent: insert 2 spaces at cursor
      const pos = wasm.get_cursor();
      wasm.replace_range(pos, pos, "  ");
      wasm.set_cursor(pos + 2);
    }

    updateCursorDisplay();
    updateVisibleLines();
    syncToStore();
    scrollToCursor();
  }

  // Handle keyboard input
  function handleKeyDown(e: KeyboardEvent) {
    if (!wasm || !isReady()) return;

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const cursor = wasm.get_cursor();
    // Normalize key to lowercase for case-insensitive shortcut matching
    const key = e.key.toLowerCase();

    // Reset cursor blink on any key

    // === Modifier shortcuts ===

    // Save: Ctrl+S
    if (isCtrl && key === "s") {
      e.preventDefault();
      syncToStore();
      if (currentDraftId()) {
        props.onSaveDraft?.();
      } else {
        props.onSaveAndPreview();
      }
      return;
    }

    // Undo: Ctrl+Z
    if (isCtrl && key === "z" && !isShift) {
      e.preventDefault();
      if (wasm.undo()) {
        clearSelection();
        updateCursorDisplay();
        updateVisibleLines();
        syncToStore();
        scrollToCursor();
      }
      return;
    }

    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if (isCtrl && (key === "y" || (key === "z" && isShift))) {
      e.preventDefault();
      if (wasm.redo()) {
        clearSelection();
        updateCursorDisplay();
        updateVisibleLines();
        syncToStore();
        scrollToCursor();
      }
      return;
    }

    // Select all: Ctrl+A
    if (isCtrl && key === "a") {
      e.preventDefault();
      const len = wasm.char_count();
      updateSelection(0, len);
      wasm.set_cursor(len);
      updateCursorDisplay();
      updateVisibleLines();
      return;
    }

    // Select word at cursor: Ctrl+D
    if (isCtrl && key === "d") {
      e.preventDefault();
      const word = findWordAt(cursor);
      if (word) {
        updateSelection(word.start, word.end);
        wasm.set_cursor(word.end);
        updateCursorDisplay();
        updateVisibleLines();
      }
      return;
    }

    // Copy: Ctrl+C
    if (isCtrl && key === "c") {
      const selected = getSelectedText();
      if (selected) {
        e.preventDefault();
        navigator.clipboard.writeText(selected).catch((err) => {
          console.error("Failed to copy to clipboard:", err);
        });
      }
      return;
    }

    // Cut: Ctrl+X
    if (isCtrl && key === "x") {
      const selected = getSelectedText();
      if (selected) {
        e.preventDefault();
        navigator.clipboard.writeText(selected).then(() => {
          if (!wasm) return;
          wasm.save_undo_state();
          deleteSelection();
          updateCursorDisplay();
          updateVisibleLines();
          syncToStore();
        }).catch((err) => {
          console.error("Failed to cut to clipboard:", err);
        });
      }
      return;
    }

    // Paste: Ctrl+V
    if (isCtrl && key === "v") {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        if (!wasm || !text) return;
        wasm.save_undo_state();
        deleteSelection();
        const pos = wasm.get_cursor();
        const newPos = wasm.replace_range(pos, pos, text);
        wasm.set_cursor(newPos);
        updateCursorDisplay();
        updateVisibleLines();
        syncToStore();
        scrollToCursor();
      }).catch((err) => {
        console.error("Failed to read from clipboard:", err);
      });
      return;
    }

    // === Navigation keys ===

    // Arrow Left
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      let newPos: number;

      if (selStart() !== null && !isShift) {
        newPos = selStart()!;
        clearSelection();
      } else if (isCtrl) {
        newPos = findWordBoundaryLeft(cursor);
      } else {
        newPos = Math.max(0, cursor - 1);
      }

      if (isShift) {
        const anchor = selectionAnchor() ?? cursor;
        updateSelection(anchor, newPos);
      }

      wasm.set_cursor(newPos);
      updateCursorDisplay();
      updateVisibleLines();
      scrollToCursor();
      return;
    }

    // Arrow Right
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const maxPos = wasm.char_count();
      let newPos: number;

      if (selEnd() !== null && !isShift) {
        newPos = selEnd()!;
        clearSelection();
      } else if (isCtrl) {
        newPos = findWordBoundaryRight(cursor);
      } else {
        newPos = Math.min(maxPos, cursor + 1);
      }

      if (isShift) {
        const anchor = selectionAnchor() ?? cursor;
        updateSelection(anchor, newPos);
      }

      wasm.set_cursor(newPos);
      updateCursorDisplay();
      updateVisibleLines();
      scrollToCursor();
      return;
    }

    // Arrow Up
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const pos = wasm.get_cursor_position() as { line: number; col: number };

      if (pos.line > 0) {
        const newPos = wasm.line_col_to_offset(pos.line - 1, pos.col);

        if (isShift) {
          const anchor = selectionAnchor() ?? cursor;
          updateSelection(anchor, newPos);
        } else if (selStart() !== null) {
          clearSelection();
        }

        wasm.set_cursor(newPos);
        updateCursorDisplay();
        updateVisibleLines();
        scrollToCursor();
      }
      return;
    }

    // Arrow Down
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const pos = wasm.get_cursor_position() as { line: number; col: number };
      const lineCount = wasm.line_count();

      if (pos.line < lineCount - 1) {
        const newPos = wasm.line_col_to_offset(pos.line + 1, pos.col);

        if (isShift) {
          const anchor = selectionAnchor() ?? cursor;
          updateSelection(anchor, newPos);
        } else if (selStart() !== null) {
          clearSelection();
        }

        wasm.set_cursor(newPos);
        updateCursorDisplay();
        updateVisibleLines();
        scrollToCursor();
      }
      return;
    }

    // Home
    if (e.key === "Home") {
      e.preventDefault();
      const pos = wasm.get_cursor_position() as { line: number; col: number };
      const newPos = isCtrl ? 0 : wasm.get_line_start(pos.line);

      if (isShift) {
        const anchor = selectionAnchor() ?? cursor;
        updateSelection(anchor, newPos);
      } else if (selStart() !== null) {
        clearSelection();
      }

      wasm.set_cursor(newPos);
      updateCursorDisplay();
      updateVisibleLines();
      scrollToCursor();
      return;
    }

    // End
    if (e.key === "End") {
      e.preventDefault();
      const pos = wasm.get_cursor_position() as { line: number; col: number };
      const newPos = isCtrl ? wasm.char_count() : wasm.get_line_end(pos.line);

      if (isShift) {
        const anchor = selectionAnchor() ?? cursor;
        updateSelection(anchor, newPos);
      } else if (selStart() !== null) {
        clearSelection();
      }

      wasm.set_cursor(newPos);
      updateCursorDisplay();
      updateVisibleLines();
      scrollToCursor();
      return;
    }

    // Page Up/Down
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      if (!contentRef) return;

      const visibleLines = Math.floor(contentRef.clientHeight / LINE_HEIGHT());
      const pos = wasm.get_cursor_position() as { line: number; col: number };
      const newLine =
        e.key === "PageUp"
          ? Math.max(0, pos.line - visibleLines)
          : Math.min(wasm.line_count() - 1, pos.line + visibleLines);
      const newPos = wasm.line_col_to_offset(newLine, pos.col);

      if (!isShift && selStart() !== null) {
        clearSelection();
      } else if (isShift) {
        const anchor = selectionAnchor() ?? cursor;
        updateSelection(anchor, newPos);
      }

      wasm.set_cursor(newPos);
      updateCursorDisplay();
      scrollToCursor();
      updateVisibleLines();
      return;
    }

    // === Editing keys ===

    // Backspace
    if (e.key === "Backspace") {
      e.preventDefault();
      wasm.save_undo_state();

      if (deleteSelection()) {
        updateCursorDisplay();
        updateVisibleLines();
        syncToStore();
        scrollToCursor();
        return;
      }

      if (cursor > 0) {
        if (isCtrl) {
          const wordStart = findWordBoundaryLeft(cursor);
          wasm.delete_range(wordStart, cursor);
          wasm.set_cursor(wordStart);
        } else {
          wasm.delete_range(cursor - 1, cursor);
          wasm.set_cursor(cursor - 1);
        }
        updateCursorDisplay();
        updateVisibleLines();
        syncToStore();
        scrollToCursor();
      }
      return;
    }

    // Delete
    if (e.key === "Delete") {
      e.preventDefault();
      wasm.save_undo_state();

      if (deleteSelection()) {
        updateCursorDisplay();
        updateVisibleLines();
        syncToStore();
        scrollToCursor();
        return;
      }

      const maxPos = wasm.char_count();
      if (cursor < maxPos) {
        if (isCtrl) {
          const wordEnd = findWordBoundaryRight(cursor);
          wasm.delete_range(cursor, wordEnd);
        } else {
          wasm.delete_range(cursor, cursor + 1);
        }
        updateCursorDisplay();
        updateVisibleLines();
        syncToStore();
      }
      return;
    }

    // Enter
    if (e.key === "Enter") {
      e.preventDefault();
      wasm.save_undo_state();
      deleteSelection();
      const pos = wasm.get_cursor();
      const newPos = wasm.replace_range(pos, pos, "\n");
      wasm.set_cursor(newPos);
      updateCursorDisplay();
      updateVisibleLines();
      syncToStore();
      scrollToCursor();
      return;
    }

    // Tab - must handle before browser does
    // Check both e.key and e.code for cross-browser compatibility
    if (e.key === "Tab" || e.code === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      handleTabKey(isShift);
      return;
    }

    // Escape - clear selection
    if (e.key === "Escape") {
      if (selStart() !== null) {
        e.preventDefault();
        clearSelection();
        updateVisibleLines();
      }
      return;
    }

    // === Character input ===
    if (e.key.length === 1 && !isCtrl && !e.altKey) {
      const hasSelection =
        selStart() !== null && selEnd() !== null && selStart() !== selEnd();

      if (hasSelection) {
        const start = selStart()!;
        const end = selEnd()!;
        const text = wasm.get_content();
        const selectedText = text.substring(start, end);
        const isMultiLine = selectedText.includes("\n");

        // Line prefixes for multi-line selection: -, *, +, >
        const linePrefixes = ["-", "*", "+", ">"];
        if (isMultiLine && linePrefixes.includes(e.key)) {
          e.preventDefault();
          handleLinePrefix(e.key);
          return;
        }

        // Wrap characters for selection
        const wrapChars = [
          '"',
          "'",
          "`",
          "(",
          ")",
          "[",
          "]",
          "{",
          "}",
          "<",
          ">",
          "*",
          "_",
        ];
        if (wrapChars.includes(e.key)) {
          e.preventDefault();
          handleWrapSelection(e.key);
          return;
        }
      }

      e.preventDefault();
      wasm.save_undo_state();
      deleteSelection();
      const pos = wasm.get_cursor();
      const newPos = wasm.replace_range(pos, pos, e.key);
      wasm.set_cursor(newPos);
      updateCursorDisplay();
      updateVisibleLines();
      syncToStore();
      scrollToCursor();
      return;
    }
  }

  // Find word boundary to the left
  function findWordBoundaryLeft(pos: number): number {
    if (!wasm || pos === 0) return 0;
    const text = wasm.get_content();
    let i = pos - 1;
    while (i > 0 && /\s/.test(text[i])) i--;
    while (i > 0 && /\w/.test(text[i - 1])) i--;
    return i;
  }

  // Find word boundary to the right
  function findWordBoundaryRight(pos: number): number {
    if (!wasm) return pos;
    const text = wasm.get_content();
    const len = text.length;
    let i = pos;
    while (i < len && /\w/.test(text[i])) i++;
    while (i < len && /\s/.test(text[i])) i++;
    return i;
  }

  // Wrap pairs for surrounding text
  const wrapPairs: Record<string, string> = {
    '"': '"',
    "'": "'",
    "`": "`",
    "(": ")",
    "[": "]",
    "{": "}",
    "<": ">",
    "*": "*",
    _: "_",
  };

  // Reverse lookup: closing char → opening char
  const closingToOpening: Record<string, string> = {
    '"': '"',
    "'": "'",
    "`": "`",
    ")": "(",
    "]": "[",
    "}": "{",
    ">": "<",
    "*": "*",
    _: "_",
  };

  // Handle wrap/unwrap selection with matching characters
  function handleWrapSelection(key: string): boolean {
    if (!wasm) return false;

    const start = selStart();
    const end = selEnd();
    if (start === null || end === null || start === end) return false;

    const openChar = wrapPairs[key] ? key : closingToOpening[key];
    const closeChar = wrapPairs[openChar];
    if (!openChar || !closeChar) return false;

    wasm.save_undo_state();
    const text = wasm.get_content();

    // Check if already wrapped
    const charBefore = start > 0 ? text[start - 1] : "";
    const charAfter = end < text.length ? text[end] : "";

    // Check if wrapped with any pair
    const isWrappedWithSame =
      charBefore === openChar && charAfter === closeChar;
    const existingOpenChar =
      closingToOpening[charAfter] === charBefore ? charBefore : null;

    if (isWrappedWithSame) {
      // Same wrap char → remove wrapping
      const newText =
        text.substring(0, start - 1) +
        text.substring(start, end) +
        text.substring(end + 1);
      wasm.set_content(newText);
      updateSelection(start - 1, end - 1);
      wasm.set_cursor(end - 1);
    } else if (existingOpenChar && wrapPairs[existingOpenChar]) {
      // Different wrap char → replace wrapping
      const newText =
        text.substring(0, start - 1) +
        openChar +
        text.substring(start, end) +
        closeChar +
        text.substring(end + 1);
      wasm.set_content(newText);
      updateSelection(start, end);
      wasm.set_cursor(end);
    } else {
      // No wrapping → add wrapping
      const newText =
        text.substring(0, start) +
        openChar +
        text.substring(start, end) +
        closeChar +
        text.substring(end);
      wasm.set_content(newText);
      updateSelection(start + 1, end + 1);
      wasm.set_cursor(end + 1);
    }

    updateCursorDisplay();
    updateVisibleLines();
    syncToStore();
    return true;
  }

  // Find word boundaries at position
  function findWordAt(pos: number): { start: number; end: number } | null {
    if (!wasm) return null;
    const text = wasm.get_content();
    if (pos >= text.length) return null;

    // Check if we're on a word character
    if (!/\w/.test(text[pos])) {
      // Try one position back
      if (pos > 0 && /\w/.test(text[pos - 1])) {
        pos = pos - 1;
      } else {
        return null;
      }
    }

    let start = pos;
    let end = pos;

    // Expand left
    while (start > 0 && /\w/.test(text[start - 1])) start--;
    // Expand right
    while (end < text.length && /\w/.test(text[end])) end++;

    return { start, end };
  }

  // Handle double-click to select word
  function handleDoubleClick(e: MouseEvent) {
    if (!wasm) return;
    e.preventDefault();
    editorRef?.focus();

    // Sync scroll position from DOM before processing click
    if (contentRef) {
      const currentScrollTop = contentRef.scrollTop;
      if (currentScrollTop !== scrollTop()) {
        setScrollTop(currentScrollTop);
      }
    }

    const pos = getLineColFromMouseEvent(e);
    if (!pos) return;

    const clickPos = wasm.line_col_to_offset(pos.line, pos.col);
    const word = findWordAt(clickPos);

    if (word) {
      updateSelection(word.start, word.end);
      wasm.set_cursor(word.end);
      updateCursorDisplay();
      updateVisibleLines();
    }
  }

  // Handle mouse click
  function handleMouseDown(e: MouseEvent) {
    if (!wasm || !contentRef) return;

    // Ignore clicks on scrollbar - let browser handle those natively
    const rect = contentRef.getBoundingClientRect();
    const isOnScrollbar = e.clientX > rect.right - 20 || e.clientY > rect.bottom - 20;
    if (isOnScrollbar) return;

    // Double-click handled separately
    if (e.detail === 2) {
      handleDoubleClick(e);
      return;
    }

    // Prevent default to stop browser from changing focus away from editorRef
    e.preventDefault();

    // Ensure editor has focus for cursor visibility
    if (document.activeElement !== editorRef) {
      editorRef?.focus();
    }

    // Sync scroll position from DOM before processing click
    // This ensures scrollTop signal is current after mouse wheel scrolling
    if (contentRef) {
      const currentScrollTop = contentRef.scrollTop;
      if (currentScrollTop !== scrollTop()) {
        setScrollTop(currentScrollTop);
      }
    }

    const pos = getLineColFromMouseEvent(e);
    if (!pos) return;

    const newPos = wasm.line_col_to_offset(pos.line, pos.col);

    if (e.shiftKey && selectionAnchor() !== null) {
      updateSelection(selectionAnchor()!, newPos);
    } else if (e.shiftKey) {
      updateSelection(wasm.get_cursor(), newPos);
    } else {
      clearSelection();
    }

    wasm.set_cursor(newPos);
    updateCursorDisplay();
    updateVisibleLines();

    // Drag selection
    if (!e.shiftKey && e.detail === 1) {
      const startPos = newPos;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dragPos = getLineColFromMouseEvent(moveEvent);
        if (!dragPos || !wasm) return;
        
        const offset = wasm.line_col_to_offset(dragPos.line, dragPos.col);
        updateSelection(startPos, offset);
        wasm.set_cursor(offset);
        updateCursorDisplay();
        updateVisibleLines();
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
  }

  // Focus handlers
  function handleFocus() {
    setIsFocused(true);
  }

  function handleBlur() {
    setIsFocused(false);
  }

  // Get span CSS class
  function getSpanClass(style: string): string {
    return style
      .split(" ")
      .map((s) => `wasm-${s}`)
      .join(" ");
  }

  // Update document height - call when content changes
  function updateDocHeight() {
    if (!wasm || !isReady()) return;
    const lineCount = wasm.line_count();
    const lineHeight = LINE_HEIGHT();
    const height = Math.max(lineCount * lineHeight + CONTENT_PADDING * 2 + 50, 100);
    setDocHeight(height);
  }

  // Starting line offset for virtual scroll
  function startLineOffset(): number {
    const lineHeight = LINE_HEIGHT();
    return Math.max(0, Math.floor(scrollTop() / lineHeight) - VISIBLE_BUFFER);
  }

  // Render line with selection highlighting
  function renderLineContent(line: HighlightedLine) {
    const start = selStart();
    const end = selEnd();

    if (start === null || end === null || !wasm) {
      return (
        <For each={line.spans}>
          {(span) => (
            <span class={getSpanClass(span.style)}>
              {span.text || "\u00A0"}
            </span>
          )}
        </For>
      );
    }

    const lineStart = wasm.get_line_start(line.num - 1);
    const lineEnd = wasm.get_line_end(line.num - 1);

    if (end <= lineStart || start >= lineEnd) {
      return (
        <For each={line.spans}>
          {(span) => (
            <span class={getSpanClass(span.style)}>
              {span.text || "\u00A0"}
            </span>
          )}
        </For>
      );
    }

    // Selection intersects this line
    const result: { text: string; style: string; selected: boolean }[] = [];
    let charPos = lineStart;

    for (const span of line.spans) {
      const spanStart = charPos;
      const spanEnd = charPos + span.text.length;

      if (spanEnd <= start || spanStart >= end) {
        result.push({ text: span.text, style: span.style, selected: false });
      } else if (spanStart >= start && spanEnd <= end) {
        result.push({ text: span.text, style: span.style, selected: true });
      } else {
        const selStartInSpan = Math.max(0, start - spanStart);
        const selEndInSpan = Math.min(span.text.length, end - spanStart);

        if (selStartInSpan > 0) {
          result.push({
            text: span.text.substring(0, selStartInSpan),
            style: span.style,
            selected: false,
          });
        }
        result.push({
          text: span.text.substring(selStartInSpan, selEndInSpan),
          style: span.style,
          selected: true,
        });
        if (selEndInSpan < span.text.length) {
          result.push({
            text: span.text.substring(selEndInSpan),
            style: span.style,
            selected: false,
          });
        }
      }

      charPos = spanEnd;
    }

    return (
      <For each={result}>
        {(part) => (
          <span
            class={`${getSpanClass(part.style)} ${part.selected ? "wasm-selected" : ""}`}
          >
            {part.text || "\u00A0"}
          </span>
        )}
      </For>
    );
  }

  return (
    <div class="wasm-editor-container">
      <Show when={error()}>
        <div class="wasm-error">
          <p>WASM Error: {error()}</p>
        </div>
      </Show>

      <Show when={isReady() && !error()}>
        <div
          ref={editorRef}
          class={`wasm-editor ${showLineNumbers() ? "with-line-numbers" : ""}`}
          style={{
            "font-size": `${markdownFontSize()}px`,
            "font-family": getFontFamilyCSS(markdownFontFamily()),
          }}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          {/* Line numbers gutter */}
          <Show when={showLineNumbers()}>
            <div
              ref={gutterRef}
              class="wasm-gutter"
              style={{
                "font-size": `${markdownFontSize()}px`,
                "font-family": getFontFamilyCSS(markdownFontFamily()),
              }}
            >
              <div
                class="wasm-gutter-content"
                style={{ height: `${docHeight()}px` }}
              >
                <div
                  class="wasm-gutter-lines"
                  style={{
                    transform: `translate3d(0, ${startLineOffset() * LINE_HEIGHT()}px, 0)`,
                  }}
                >
                  <For each={lines()}>
                    {(line) => (
                      <div
                        class="wasm-line-number"
                        classList={{ active: cursorLine() === line.num - 1 }}
                        style={{ height: `${LINE_HEIGHT()}px` }}
                      >
                        {line.num}
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </Show>

          {/* Editor content */}
          <div
            ref={contentRef}
            class="wasm-content"
            onScroll={handleScroll}
            onMouseDown={handleMouseDown}
          >
            <div
              class="wasm-content-inner"
              style={{ height: `${docHeight()}px` }}
            >
              <div
                class="wasm-lines"
                style={{
                  transform: `translate3d(0, ${startLineOffset() * LINE_HEIGHT()}px, 0)`,
                }}
              >
                <For each={lines()}>
                  {(line) => (
                    <div
                      class="wasm-line"
                      classList={{ active: cursorLine() === line.num - 1 }}
                      style={{
                        height: `${LINE_HEIGHT()}px`,
                        "line-height": `${LINE_HEIGHT()}px`,
                      }}
                    >
                      {renderLineContent(line)}
                      {line.spans.length === 0 && (
                        <span class="wasm-text">&nbsp;</span>
                      )}

                      {/* Cursor */}
                      <Show when={cursorLine() === line.num - 1 && isFocused()}>
                        <span
                          class="wasm-cursor"
                          classList={{ visible: isFocused() }}
                          style={{ left: `${cursorCol() * CHAR_WIDTH()}px` }}
                        />
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div class="wasm-status">
          <span>
            Ln {cursorLine() + 1}, Col {cursorCol() + 1}
          </span>
          <Show when={wasm}>
            <span>{wasm!.line_count()} lines</span>
          </Show>
        </div>
      </Show>
    </div>
  );
}
