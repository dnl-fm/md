/**
 * Markdown viewer component with preview and edit modes.
 *
 * Features:
 * - Preview mode: renders markdown as styled HTML with syntax highlighting
 * - Edit mode: textarea with line numbers, undo/redo, smart indentation
 * - Search: highlights matches in preview with minimap navigation
 * - Keyboard shortcuts for editing (Tab indent, wrap selection, etc.)
 */
import { Show, createEffect, createMemo, createSignal, For } from "solid-js";
import {
  content,
  setContent,
  renderedHtml,
  showRawMarkdown,
  showLineNumbers,
  markdownFontSize,
  markdownFontFamily,
  searchQuery,
  setSearchMatches,
  currentMatch,
  setCurrentMatch,
  searchMatches,
  currentDraftId,
  currentFile,
} from "../stores/app-store";
import { getFontFamilyCSS } from "../utils";
import { EmptyState } from "./empty-state";
import { SearchBar } from "./search-bar";

/** Undo/redo history entry */
type HistoryEntry = { text: string; cursorPos: number };

/** Per-file undo/redo history */
type FileHistory = { undo: HistoryEntry[]; redo: HistoryEntry[] };

/** Map of file path or draft ID to undo/redo stacks */
const historyMap = new Map<string, FileHistory>();

/** Maximum undo stack size per file */
const MAX_HISTORY_SIZE = 100;

/**
 * Get the current history key based on active file or draft.
 * Returns empty string if nothing is open (shouldn't happen in practice).
 */
function getHistoryKey(): string {
  return currentDraftId() ?? currentFile() ?? "";
}

/**
 * Get or create undo/redo stacks for the current file/draft.
 */
function getHistory(): FileHistory {
  const key = getHistoryKey();
  if (!historyMap.has(key)) {
    historyMap.set(key, { undo: [], redo: [] });
  }
  return historyMap.get(key)!;
}

/**
 * Clear history for a specific file/draft (e.g., after save or discard).
 */
export function clearHistoryFor(key: string) {
  historyMap.delete(key);
}

/** Props for MarkdownViewer component */
interface MarkdownViewerProps {
  /** Handler to save file and switch to preview */
  onSaveAndPreview: () => void;
  /** Handler to save draft to new file */
  onSaveDraft?: () => void;
}

/** Search match position for minimap display */
interface MatchPosition {
  /** Match index (1-based) */
  index: number;
  /** Vertical position as percentage of document height */
  percent: number;
}

/**
 * Main content area showing markdown preview or editor.
 */
export function MarkdownViewer(props: MarkdownViewerProps) {
  let containerRef: HTMLDivElement | undefined;
  let articleRef: HTMLElement | undefined;
  const [matchPositions, setMatchPositions] = createSignal<MatchPosition[]>([]);

  // Get highlighted HTML with search matches
  const highlightedHtml = createMemo(() => {
    const html = renderedHtml();
    const query = searchQuery().trim();

    if (!query || !html || showRawMarkdown()) {
      setSearchMatches(0);
      setCurrentMatch(0);
      return html;
    }

    // Escape regex special characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedQuery})`, "gi");

    // Count matches in text content only (not in HTML tags)
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const textContent = tempDiv.textContent || "";
    const matches = textContent.match(regex);
    const matchCount = matches ? matches.length : 0;
    setSearchMatches(matchCount);

    if (matchCount > 0 && currentMatch() === 0) {
      setCurrentMatch(1);
    } else if (currentMatch() > matchCount) {
      setCurrentMatch(matchCount);
    }

    // Highlight matches in the HTML (only in text nodes, not in tags)
    let matchIndex = 0;
    const highlightedHtml = html.replace(
      /(<[^>]*>)|([^<]+)/g,
      (match, tag, text) => {
        if (tag) return tag; // Return HTML tags unchanged
        if (!text) return match;

        // Replace matches in text content
        return text.replace(regex, (m: string) => {
          matchIndex++;
          const isCurrent = matchIndex === currentMatch();
          return `<mark class="search-highlight${isCurrent ? " current" : ""}" data-match="${matchIndex}">${m}</mark>`;
        });
      }
    );

    return highlightedHtml;
  });

  // Calculate match positions for minimap after DOM updates
  createEffect(() => {
    const query = searchQuery().trim();
    const matches = searchMatches();
    
    if (!query || matches === 0 || !articleRef || showRawMarkdown()) {
      setMatchPositions([]);
      return;
    }

    // Delay to let DOM update with highlights
    setTimeout(() => {
      if (!articleRef) return;
      
      const scrollHeight = articleRef.scrollHeight;
      const highlights = articleRef.querySelectorAll(".search-highlight");
      const positions: MatchPosition[] = [];
      
      highlights.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const articleRect = articleRef!.getBoundingClientRect();
        const scrollTop = articleRef!.scrollTop;
        
        // Calculate position relative to full document height
        const offsetTop = rect.top - articleRect.top + scrollTop;
        const percent = (offsetTop / scrollHeight) * 100;
        
        positions.push({ index: idx + 1, percent });
      });
      
      setMatchPositions(positions);
    }, 20);
  });

  // Scroll to current match
  createEffect(() => {
    const match = currentMatch();
    if (match > 0 && containerRef && !showRawMarkdown()) {
      // Small delay to allow DOM update
      setTimeout(() => {
        const currentEl = containerRef?.querySelector(
          `.search-highlight[data-match="${match}"]`
        );
        if (currentEl) {
          currentEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 10);
    }
  });

  function navigateMatch(direction: "next" | "prev") {
    const total = document.querySelectorAll(".search-highlight").length;
    if (total === 0) return;

    let next = currentMatch();
    if (direction === "next") {
      next = next >= total ? 1 : next + 1;
    } else {
      next = next <= 1 ? total : next - 1;
    }
    setCurrentMatch(next);
  }

  function handleMinimapClick(index: number) {
    setCurrentMatch(index);
  }

  return (
    <div class="markdown-container" ref={containerRef}>
      <SearchBar onNavigate={navigateMatch} />
      <Show when={content() || showRawMarkdown() || currentDraftId()} fallback={<EmptyState />}>
        <Show when={showRawMarkdown()}>
          {(() => {
            let textareaRef: HTMLTextAreaElement | undefined;
            let gutterRef: HTMLDivElement | undefined;
            
            const [currentLine, setCurrentLine] = createSignal(1);
            
            const pushUndo = (text: string, cursorPos: number) => {
              const history = getHistory();
              // Don't push if same as last entry
              if (history.undo.length > 0 && history.undo[history.undo.length - 1].text === text) return;
              history.undo.push({ text, cursorPos });
              // Limit stack size
              if (history.undo.length > MAX_HISTORY_SIZE) history.undo.shift();
              // Clear redo on new change
              history.redo.length = 0;
            };
            
            const undo = () => {
              const history = getHistory();
              if (!textareaRef || history.undo.length === 0) return;
              // Save current state to redo
              history.redo.push({ text: textareaRef.value, cursorPos: textareaRef.selectionStart });
              const entry = history.undo.pop()!;
              textareaRef.value = entry.text;
              textareaRef.setSelectionRange(entry.cursorPos, entry.cursorPos);
              setContent(entry.text);
              updateCurrentLine();
            };
            
            const redo = () => {
              const history = getHistory();
              if (!textareaRef || history.redo.length === 0) return;
              // Save current state to undo
              history.undo.push({ text: textareaRef.value, cursorPos: textareaRef.selectionStart });
              const entry = history.redo.pop()!;
              textareaRef.value = entry.text;
              textareaRef.setSelectionRange(entry.cursorPos, entry.cursorPos);
              setContent(entry.text);
              updateCurrentLine();
            };
            
            const lineCount = createMemo(() => {
              const text = content();
              return text ? text.split("\n").length : 1;
            });
            
            const syncScroll = () => {
              if (gutterRef && textareaRef) {
                gutterRef.scrollTop = textareaRef.scrollTop;
              }
            };
            
            const updateCurrentLine = () => {
              if (textareaRef) {
                const text = textareaRef.value.substring(0, textareaRef.selectionStart);
                const line = text.split("\n").length;
                setCurrentLine(line);
              }
            };
            
            return (
              <div class={`editor-container ${showLineNumbers() ? "with-line-numbers" : ""}`}>
                <Show when={showLineNumbers()}>
                  <div
                    ref={gutterRef}
                    class="line-numbers"
                    style={{
                      "font-size": `${markdownFontSize()}px`,
                      "font-family": getFontFamilyCSS(markdownFontFamily()),
                    }}
                  >
                    <For each={Array.from({ length: lineCount() }, (_, i) => i + 1)}>
                      {(num) => (
                        <div class={`line-number ${currentLine() === num ? "active" : ""}`}>
                          {num}
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <textarea
                  ref={(el) => {
                    textareaRef = el;
                    el.value = content();
                    setTimeout(() => {
                      el.focus();
                      el.setSelectionRange(0, 0);
                    }, 0);
                  }}
                  class="markdown-raw markdown-editor"
                  style={{
                    "font-size": `${markdownFontSize()}px`,
                    "font-family": getFontFamilyCSS(markdownFontFamily()),
                  }}
                  onBeforeInput={(e) => {
                    // Push undo before any input change
                    const textarea = e.currentTarget as HTMLTextAreaElement;
                    pushUndo(textarea.value, textarea.selectionStart);
                  }}
                  onInput={(e) => {
                    setContent(e.currentTarget.value);
                    updateCurrentLine();
                  }}
                  onScroll={syncScroll}
                  onClick={updateCurrentLine}
                  onKeyUp={(e) => {
                    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
                      updateCurrentLine();
                    }
                  }}
                  onKeyDown={(e) => {
                    const textarea = e.currentTarget;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const hasSelection = start !== end;
                    
                    // Undo/Redo
                    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z" || e.key === "y")) {
                      e.preventDefault();
                      if (e.key === "y" || e.shiftKey || e.key === "Z") {
                        redo();
                      } else {
                        undo();
                      }
                      return;
                    }
                    
                    // Wrap selection with matching characters
                    const wrapPairs: Record<string, string> = {
                      "'": "'", '"': '"', '`': '`',
                      '(': ')', '[': ']', '{': '}',
                      '<': '>', '*': '*', '_': '_',
                    };
                    const closingToOpening: Record<string, string> = {
                      "'": "'", '"': '"', '`': '`',
                      ')': '(', ']': '[', '}': '{',
                      '>': '<', '*': '*', '_': '_',
                    };
                    
                    if (hasSelection && wrapPairs[e.key]) {
                      e.preventDefault();
                      pushUndo(textarea.value, start);
                      const selected = textarea.value.substring(start, end);
                      
                      // Check if already wrapped - look at chars before/after selection
                      const value = textarea.value;
                      const charBefore = start > 0 ? value[start - 1] : "";
                      const charAfter = end < value.length ? value[end] : "";
                      const isWrapped = charBefore && charAfter &&
                        wrapPairs[charBefore] === charAfter &&
                        closingToOpening[charAfter] === charBefore;
                      
                      let newText: string;
                      let newStart: number;
                      let newEnd: number;
                      let replaceStart: number;
                      let replaceEnd: number;
                      
                      if (isWrapped) {
                        // Replace existing wrapper with new one (include the wrapper chars)
                        replaceStart = start - 1;
                        replaceEnd = end + 1;
                        newText = e.key + selected + wrapPairs[e.key];
                        newStart = start; // cursor stays at same position
                        newEnd = end;
                      } else {
                        // Wrap with new characters
                        replaceStart = start;
                        replaceEnd = end;
                        newText = e.key + selected + wrapPairs[e.key];
                        newStart = start + 1;
                        newEnd = end + 1;
                      }
                      
                      // Select the range to replace, then insert
                      textarea.setSelectionRange(replaceStart, replaceEnd);
                      
                      document.execCommand('insertText', false, newText);
                      // Sync to state without re-render (onInput will handle it)
                      // setContent called via dispatchEvent to trigger onInput
                      textarea.dispatchEvent(new Event('input', { bubbles: true }));
                      
                      queueMicrotask(() => {
                        textarea.setSelectionRange(newStart, newEnd);
                      });
                      return;
                    }
                    
                    if (e.key === "Tab" || e.code === "Tab") {
                      e.preventDefault();
                      e.stopPropagation();
                      pushUndo(textarea.value, start);
                      const value = textarea.value;
                      
                      // Find line boundaries for selection
                      const firstLineStart = value.lastIndexOf("\n", start - 1) + 1;
                      const lastLineEnd = value.indexOf("\n", end);
                      const selectionEnd = lastLineEnd === -1 ? value.length : lastLineEnd;
                      
                      // Get selected lines
                      const selectedText = value.substring(firstLineStart, selectionEnd);
                      const lines = selectedText.split("\n");
                      
                      let newLines: string[];
                      let deltaFirst = 0;
                      let deltaTotal = 0;
                      
                      if (e.shiftKey) {
                        // Dedent: remove up to 2 spaces from start of each line
                        newLines = lines.map((line, i) => {
                          const spaces = line.startsWith("  ") ? 2 : line.startsWith(" ") ? 1 : 0;
                          if (i === 0) deltaFirst = -spaces;
                          deltaTotal -= spaces;
                          return line.substring(spaces);
                        });
                      } else {
                        // Indent: add 2 spaces to start of each line
                        newLines = lines.map((line, i) => {
                          if (i === 0) deltaFirst = 2;
                          deltaTotal += 2;
                          return "  " + line;
                        });
                      }
                      
                      // Select the lines we're modifying, then use execCommand
                      textarea.setSelectionRange(firstLineStart, selectionEnd);
                      document.execCommand('insertText', false, newLines.join("\n"));
                      textarea.dispatchEvent(new Event('input', { bubbles: true }));
                      
                      const newStart = Math.max(firstLineStart, start + deltaFirst);
                      const newEnd = end + deltaTotal;
                      queueMicrotask(() => {
                        textarea.setSelectionRange(newStart, newEnd);
                      });
                    } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                      e.preventDefault();
                      if (currentDraftId()) {
                        props.onSaveDraft?.();
                      } else {
                        props.onSaveAndPreview();
                      }
                    }
                  }}
                  spellcheck={false}
                />
              </div>
            );
          })()}
        </Show>
        <Show when={!showRawMarkdown()}>
          <article
            ref={articleRef}
            class="markdown-content markdown-body"
            innerHTML={highlightedHtml()}
            style={{
              "font-size": `${markdownFontSize()}px`,
              "font-family": getFontFamilyCSS(markdownFontFamily()),
            }}
          />
          {/* Search matches minimap */}
          <Show when={matchPositions().length > 0}>
            <div class="search-minimap">
              <For each={matchPositions()}>
                {(pos) => (
                  <div
                    class={`search-minimap-mark ${pos.index === currentMatch() ? "current" : ""}`}
                    style={{ top: `${pos.percent}%` }}
                    onClick={() => handleMinimapClick(pos.index)}
                    title={`Match ${pos.index}`}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  );
}
