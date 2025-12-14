/**
 * Markdown viewer component with preview and edit modes.
 *
 * Features:
 * - Preview mode: renders markdown as styled HTML with syntax highlighting
 * - Edit mode: WASM-based editor with syntax highlighting, undo/redo
 * - Search: highlights matches in preview with minimap navigation
 */
import { Show, createEffect, createMemo, createSignal, For, createRenderEffect } from "solid-js";
import mermaid from "mermaid";
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
  previewScrollLine,
  setPreviewScrollLine,
  config,
} from "../stores/app-store";
import { getFontFamilyCSS } from "../utils";
import { EmptyState } from "./empty-state";
import { SearchBar } from "./search-bar";
import { WasmEditor, type WasmEditorApi } from "./wasm-editor";

/** Props for MarkdownViewer component */
interface MarkdownViewerProps {
  /** Handler to save file and switch to preview */
  onSaveAndPreview: () => void;
  /** Handler to save draft to new file */
  onSaveDraft?: () => void;
  /** Callback to receive editor API for scroll sync */
  onEditorApi?: (api: WasmEditorApi | null) => void;
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
  // Reactive ref so effects re-run when article mounts
  const [articleEl, setArticleEl] = createSignal<HTMLElement | null>(null);
  const [matchPositions, setMatchPositions] = createSignal<MatchPosition[]>([]);
  const [mermaidSvgs, setMermaidSvgs] = createSignal<Map<number, string>>(new Map());
  const [mermaidHeights, setMermaidHeights] = createSignal<Map<number, number>>(new Map());

  // Render mermaid diagrams progressively - each pops in when ready
  createEffect(() => {
    const html = renderedHtml();
    const theme = config().theme;
    if (!html) return;
    
    // Extract mermaid code from data attributes
    const regex = /data-mermaid="([^"]+)"/g;
    const matches = [...html.matchAll(regex)];
    if (matches.length === 0) {
      setMermaidSvgs(new Map());
      return;
    }
    
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
    });
    
    // Render all diagrams in background, then swap all at once (no flicker)
    const renderAll = async () => {
      const newSvgs = new Map<number, string>();
      
      for (let index = 0; index < matches.length; index++) {
        const match = matches[index];
        const encoded = match[1];
        const decoded = encoded
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        
        try {
          const id = `mermaid-${theme}-${index}-${Date.now()}`;
          const { svg } = await mermaid.render(id, decoded);
          newSvgs.set(index, svg);
          
          // Extract and store height for future re-renders
          let height = 0;
          const heightMatch = svg.match(/height="([\d.]+)/);
          if (heightMatch) {
            height = parseFloat(heightMatch[1]);
          }
          if (!height) {
            const viewBoxMatch = svg.match(/viewBox="[\d.]+ [\d.]+ [\d.]+ ([\d.]+)"/);
            if (viewBoxMatch) {
              height = parseFloat(viewBoxMatch[1]);
            }
          }
          setMermaidHeights(prev => new Map(prev).set(index, height || 100));
        } catch (err) {
          console.error('Mermaid error:', err);
          newSvgs.set(index, `<pre class="mermaid-error">Error: ${err}</pre>`);
        }
        
        // Yield to keep UI responsive
        await new Promise(r => requestAnimationFrame(r));
      }
      
      // Swap all at once
      setMermaidSvgs(newSvgs);
    };
    
    renderAll();
  });

  // Get highlighted HTML with search matches and mermaid SVGs
  const highlightedHtml = createMemo(() => {
    const html = renderedHtml();
    const svgs = mermaidSvgs();
    const heights = mermaidHeights(); // Read early to track as dependency
    const query = searchQuery().trim();

    if (!html || showRawMarkdown()) {
      setSearchMatches(0);
      setCurrentMatch(0);
      return html;
    }
    
    // Replace mermaid placeholders with rendered SVGs or loading spinner
    let diagramIndex = 0;
    let processedHtml = html.replace(
      /<div class="mermaid-diagram" id="[^"]*" data-mermaid="[^"]+"><\/div>/g,
      () => {
        const idx = diagramIndex++;
        const svg = svgs.get(idx);
        const height = heights.get(idx);
        const style = height ? ` style="min-height:${height}px"` : '';
        if (svg) {
          return `<div class="mermaid-diagram"${style}>${svg}</div>`;
        }
        // Show spinner with preserved height
        return `<div class="mermaid-diagram"${style}><div class="mermaid-loading"><span class="spinner"></span></div></div>`;
      }
    );

    if (!query) {
      setSearchMatches(0);
      setCurrentMatch(0);
      return processedHtml;
    }

    // Escape regex special characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(`(${escapedQuery})`, "gi");

    // Count matches in text content only (not in HTML tags)
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = processedHtml;
    const textContent = tempDiv.textContent || "";
    const foundMatches = textContent.match(searchRegex);
    const matchCount = foundMatches ? foundMatches.length : 0;
    setSearchMatches(matchCount);

    if (matchCount > 0 && currentMatch() === 0) {
      setCurrentMatch(1);
    } else if (currentMatch() > matchCount) {
      setCurrentMatch(matchCount);
    }

    // Highlight matches in the HTML (only in text nodes, not in tags)
    let matchIndex = 0;
    const finalHtml = processedHtml.replace(
      /(<[^>]*>)|([^<]+)/g,
      (match, tag, text) => {
        if (tag) return tag; // Return HTML tags unchanged
        if (!text) return match;

        // Replace matches in text content
        return text.replace(searchRegex, (m: string) => {
          matchIndex++;
          const isCurrent = matchIndex === currentMatch();
          return `<mark class="search-highlight${isCurrent ? " current" : ""}" data-match="${matchIndex}">${m}</mark>`;
        });
      }
    );

    return finalHtml;
  });

  // Calculate match positions for minimap after DOM updates
  createEffect(() => {
    const query = searchQuery().trim();
    const matches = searchMatches();
    const article = articleEl();
    
    if (!query || matches === 0 || !article || showRawMarkdown()) {
      setMatchPositions([]);
      return;
    }

    // Delay to let DOM update with highlights
    setTimeout(() => {
      const el = articleEl();
      if (!el) return;
      
      const scrollHeight = el.scrollHeight;
      const highlights = el.querySelectorAll(".search-highlight");
      const positions: MatchPosition[] = [];
      
      highlights.forEach((highlight, idx) => {
        const rect = highlight.getBoundingClientRect();
        const articleRect = el.getBoundingClientRect();
        const scrollTop = el.scrollTop;
        
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

  // Scroll to position from editor when switching to preview
  // Uses data-line attributes on block elements for precise mapping
  // createRenderEffect runs after DOM updates, so articleEl() will be set
  createRenderEffect(() => {
    const article = articleEl();
    const targetLine = previewScrollLine();
    
    if (!article || targetLine === null) return;
    
    // Defer one tick so layout is stable
    requestAnimationFrame(() => {
      scrollPreviewToLine(article, targetLine);
      setPreviewScrollLine(null);
    });
  });

  function scrollPreviewToLine(article: HTMLElement, targetLine: number) {
    // Find element with data-line closest to (but not exceeding) targetLine
    const elementsWithLine = article.querySelectorAll('[data-line]');
    let bestMatch: Element | null = null;
    let bestLine = -1;

    for (const el of elementsWithLine) {
      const line = parseInt((el as HTMLElement).dataset.line ?? '', 10);
      if (!isNaN(line) && line <= targetLine && line > bestLine) {
        bestLine = line;
        bestMatch = el;
      }
    }

    if (bestMatch) {
      bestMatch.scrollIntoView({ behavior: 'instant', block: 'start' });
      // Offset slightly from top
      if (containerRef) {
        containerRef.scrollTop = Math.max(0, containerRef.scrollTop - 20);
      }
    } else {
      // Fallback: proportional scroll
      const rawContent = content();
      if (rawContent && containerRef) {
        const totalLines = rawContent.split('\n').length;
        const proportion = targetLine / totalLines;
        containerRef.scrollTop = proportion * article.scrollHeight;
      }
    }
  }

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
            onApi={props.onEditorApi}
          />
        </Show>
        <Show when={!showRawMarkdown()}>
          <article
            ref={setArticleEl}
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
