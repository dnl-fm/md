/**
 * Markdown viewer component with preview and edit modes.
 *
 * Features:
 * - Preview mode: renders markdown as styled HTML with syntax highlighting
 * - Edit mode: WASM-based editor with syntax highlighting, undo/redo
 * - Search: highlights matches in preview with minimap navigation
 */
import { Show, createEffect, createMemo, createSignal, For } from "solid-js";
import {
  content,
  renderedHtml,
  showRawMarkdown,
  markdownFontSize,
  markdownFontFamily,
  searchQuery,
  setSearchMatches,
  currentMatch,
  setCurrentMatch,
  searchMatches,
  currentDraftId,
} from "../stores/app-store";
import { getFontFamilyCSS } from "../utils";
import { EmptyState } from "./empty-state";
import { SearchBar } from "./search-bar";
import { WasmEditor } from "./wasm-editor";

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
    <div class={`markdown-container ${showRawMarkdown() ? '' : 'preview-mode'}`} ref={containerRef}>
      <SearchBar onNavigate={navigateMatch} />
      <Show when={content() || showRawMarkdown() || currentDraftId()} fallback={<EmptyState />}>
        <Show when={showRawMarkdown()}>
          <WasmEditor
            onSaveAndPreview={props.onSaveAndPreview}
            onSaveDraft={props.onSaveDraft}
          />
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
