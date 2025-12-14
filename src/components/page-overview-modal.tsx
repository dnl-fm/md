/**
 * Page overview panel - slide-in from right with TOC and page thumbnails.
 */
import { Show, For, createSignal, createEffect } from "solid-js";
import html2canvas from "html2canvas";
import { content, config } from "../stores/app-store";

interface PageOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentElement: HTMLElement | null;
}

interface PageThumb {
  index: number;
  dataUrl: string;
  scrollY: number;
}

interface TocItem {
  level: number;
  text: string;
  scrollY: number;
}

type TabType = "toc" | "pages";

// Remember last selected tab
const STORAGE_KEY = "page-overview-tab";
function getStoredTab(): TabType {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "pages" ? "pages" : "toc";
}
function storeTab(tab: TabType) {
  localStorage.setItem(STORAGE_KEY, tab);
}

// Cache thumbnails by content+theme hash (separate cache per theme for instant switching)
const thumbnailCache = new Map<string, PageThumb[]>();
let preRenderInProgress = false;

// Observable for pre-render status (for showing spinner in UI)
type PreRenderListener = (isRendering: boolean) => void;
const preRenderListeners: Set<PreRenderListener> = new Set();

export function onPreRenderStatus(listener: PreRenderListener): () => void {
  preRenderListeners.add(listener);
  return () => preRenderListeners.delete(listener);
}

function notifyPreRenderStatus(isRendering: boolean) {
  preRenderListeners.forEach(fn => fn(isRendering));
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/** Generate a single page thumbnail */
async function generateSingleThumbnail(
  el: HTMLElement,
  index: number,
  scrollY: number,
  pgHeight: number,
  bgColor: string
): Promise<PageThumb> {
  const canvas = await html2canvas(el, {
    y: scrollY,
    height: pgHeight,
    windowHeight: pgHeight,
    scrollY: -scrollY,
    useCORS: true,
    logging: false,
    scale: 0.3,
    backgroundColor: bgColor,
  });
  
  return {
    index,
    dataUrl: canvas.toDataURL("image/jpeg", 0.7),
    scrollY,
  };
}

/**
 * Pre-render thumbnails in the background (parallel).
 * Call this after content is rendered to have thumbnails ready when modal opens.
 */
export async function preRenderThumbnails(
  contentElement: HTMLElement | null,
  contentStr: string,
  theme: string
): Promise<void> {
  if (!contentElement) return;
  
  const cacheKey = simpleHash(contentStr + theme);
  
  if (thumbnailCache.has(cacheKey)) return;
  if (preRenderInProgress) return;
  
  preRenderInProgress = true;
  notifyPreRenderStatus(true);
  
  try {
    await new Promise(r => setTimeout(r, 100));
    
    const el = contentElement;
    const contentWidth = el.scrollWidth;
    const a4Ratio = 297 / 210;
    const pgHeight = Math.round(contentWidth * a4Ratio);
    const totalHeight = el.scrollHeight;
    const pageCount = Math.ceil(totalHeight / pgHeight);
    
    const bgColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-primary').trim() || '#ffffff';
    
    console.log(`[Background] Pre-rendering ${pageCount} pages...`);
    
    const promises: Promise<PageThumb>[] = [];
    for (let i = 0; i < pageCount; i++) {
      const scrollY = i * pgHeight;
      promises.push(generateSingleThumbnail(el, i, scrollY, pgHeight, bgColor));
    }
    
    const thumbs = await Promise.all(promises);
    thumbs.sort((a, b) => a.index - b.index);
    
    thumbnailCache.set(cacheKey, thumbs);
    console.log(`[Background] Pre-render complete`);
  } catch (err) {
    console.error("[Background] Pre-render failed:", err);
  } finally {
    preRenderInProgress = false;
    notifyPreRenderStatus(false);
  }
}

// Remember grid size preference
type GridSize = "single" | "double";
const GRID_SIZE_KEY = "page-overview-grid-size";
function getStoredGridSize(): GridSize {
  const stored = localStorage.getItem(GRID_SIZE_KEY);
  return stored === "double" ? "double" : "single";
}
function storeGridSize(size: GridSize) {
  localStorage.setItem(GRID_SIZE_KEY, size);
}

export function PageOverviewModal(props: PageOverviewModalProps) {
  const [activeTab, setActiveTab] = createSignal<TabType>(getStoredTab());
  const [gridSize, setGridSize] = createSignal<GridSize>(getStoredGridSize());
  const [thumbnails, setThumbnails] = createSignal<PageThumb[]>([]);
  const [tocItems, setTocItems] = createSignal<TocItem[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [currentScrollY, setCurrentScrollY] = createSignal(0);
  const [expectedPageCount, setExpectedPageCount] = createSignal(0);
  
  // Track scroll position when modal is open
  createEffect(() => {
    const isOpen = props.isOpen;
    const container = props.contentElement?.parentElement;
    
    if (!isOpen || !container) return;
    
    const handleScroll = () => {
      setCurrentScrollY(container.scrollTop);
    };
    
    // Get initial position
    handleScroll();
    
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  });

  // Load thumbnails from cache or generate when modal opens
  createEffect(() => {
    const isOpen = props.isOpen;
    const el = props.contentElement;
    const currentContent = content();
    const theme = config().theme;
    const tab = activeTab();
    
    // Need modal open, content element, and actual content
    if (!isOpen || !el || !currentContent) return;
    
    extractToc();
    
    const cacheKey = simpleHash(currentContent + theme);
    const cached = thumbnailCache.get(cacheKey);
    
    // Only use cache if it matches current theme
    if (cached && cached.length > 0) {
      // Ensure expected page count is set for the grid
      if (expectedPageCount() !== cached.length) {
        setExpectedPageCount(cached.length);
      }
      if (thumbnails() !== cached) {
        setThumbnails(cached);
      }
      return;
    }
    
    // Clear thumbnails from different theme
    if (thumbnails().length > 0) {
      setThumbnails([]);
    }
    
    // Generate if on pages tab (delay to let mermaid re-render with new theme)
    if (tab === "pages" && !loading()) {
      updateExpectedPageCount();
      setTimeout(() => {
        generateThumbnails(cacheKey);
      }, 300);
    }
  });

  /** Calculate and set expected page count for skeleton placeholders */
  function updateExpectedPageCount() {
    const el = props.contentElement;
    if (!el) return;
    
    const contentWidth = el.scrollWidth;
    const a4Ratio = 297 / 210;
    const pgHeight = Math.round(contentWidth * a4Ratio);
    const totalHeight = el.scrollHeight;
    const expectedPages = Math.ceil(totalHeight / pgHeight);
    setExpectedPageCount(expectedPages);
  }

  function switchTab(tab: TabType) {
    setActiveTab(tab);
    storeTab(tab);
    // Generate thumbnails on first switch to pages tab
    if (tab === "pages" && thumbnails().length === 0 && props.contentElement && !loading()) {
      // Calculate expected pages for skeletons
      updateExpectedPageCount();
      
      const cacheKey = simpleHash(content() + config().theme);
      const cached = thumbnailCache.get(cacheKey);
      if (cached && cached.length > 0) {
        setThumbnails(cached);
      } else {
        // Delay to let mermaid re-render with current theme
        setTimeout(() => {
          generateThumbnails(cacheKey);
        }, 300);
      }
    }
  }

  function extractToc() {
    const el = props.contentElement;
    if (!el) return;

    const headings = el.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const items: TocItem[] = [];

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName[1]);
      const text = heading.textContent || "";
      const rect = heading.getBoundingClientRect();
      const containerRect = el.parentElement?.getBoundingClientRect();
      const scrollTop = el.parentElement?.scrollTop || 0;
      const scrollY = rect.top - (containerRect?.top || 0) + scrollTop;

      items.push({ level, text, scrollY });
    });

    setTocItems(items);
  }

  // Find which TOC item is currently active based on scroll position
  function getActiveTocIndex(): number {
    const scrollY = currentScrollY();
    const items = tocItems();
    
    for (let i = items.length - 1; i >= 0; i--) {
      if (scrollY >= items[i].scrollY - 50) {
        return i;
      }
    }
    return 0;
  }

  // Find which page is currently active based on scroll position
  function getActivePageIndex(): number {
    const scrollY = currentScrollY();
    const thumbs = thumbnails();
    
    for (let i = thumbs.length - 1; i >= 0; i--) {
      if (scrollY >= thumbs[i].scrollY - 50) {
        return i;
      }
    }
    return 0;
  }

  async function generateThumbnails(contentHash: string) {
    const el = props.contentElement;
    if (!el) {
      setError("No content element");
      return;
    }

    setLoading(true);
    setError(null);
    setThumbnails([]);

    try {
      // A4 ratio: 210mm x 297mm = 1:1.414
      const contentWidth = el.scrollWidth;
      const a4Ratio = 297 / 210;
      const pgHeight = Math.round(contentWidth * a4Ratio);
      const totalHeight = el.scrollHeight;
      const pageCount = Math.ceil(totalHeight / pgHeight);
      
      // Get background color from theme
      const bgColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-primary').trim() || '#ffffff';

      console.log(`Generating ${pageCount} A4 pages in parallel...`);

      // Generate all pages in parallel
      const promises: Promise<PageThumb>[] = [];
      for (let i = 0; i < pageCount; i++) {
        const scrollY = i * pgHeight;
        promises.push(generateSingleThumbnail(el, i, scrollY, pgHeight, bgColor));
      }
      
      const thumbs = await Promise.all(promises);
      thumbs.sort((a, b) => a.index - b.index);
      setThumbnails(thumbs);
      
      // Cache the results
      thumbnailCache.set(contentHash, thumbs);
    } catch (err) {
      console.error("html2canvas error:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handlePageClick(thumb: PageThumb) {
    const container = props.contentElement?.parentElement;
    if (container) {
      container.scrollTo({
        top: Math.max(0, thumb.scrollY - 20),
        behavior: "smooth"
      });
    }
  }

  function handleTocClick(item: TocItem) {
    const container = props.contentElement?.parentElement;
    const contentEl = props.contentElement;
    if (container && contentEl) {
      container.scrollTo({
        top: Math.max(0, item.scrollY - 20),
        behavior: "smooth"
      });
      
      // Flash the heading to draw attention
      const headings = contentEl.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const tocIndex = tocItems().indexOf(item);
      const heading = headings[tocIndex] as HTMLElement;
      if (heading) {
        heading.classList.add("highlight-flash");
        setTimeout(() => heading.classList.remove("highlight-flash"), 1500);
      }
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  }

  return (
    <Show when={props.isOpen}>
      <div class="page-overview-backdrop" onClick={handleBackdropClick}>
        <div class="page-overview-panel">
          <div class="page-overview-header">
            <div class="page-overview-tabs">
              <button
                class={`tab-btn ${activeTab() === "toc" ? "active" : ""}`}
                onClick={() => switchTab("toc")}
              >
                Contents
              </button>
              <button
                class={`tab-btn ${activeTab() === "pages" ? "active" : ""}`}
                onClick={() => switchTab("pages")}
              >
                Pages
              </button>
            </div>
            <div class="page-overview-actions">
              <Show when={activeTab() === "pages"}>
                <div class="grid-size-toggle">
                  <button
                    class={`grid-size-btn ${gridSize() === "single" ? "active" : ""}`}
                    onClick={() => { setGridSize("single"); storeGridSize("single"); }}
                    title="Single column"
                  >
                    <svg width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M1 3a2 2 0 012-2h5l4 4v10a2 2 0 01-2 2H3a2 2 0 01-2-2V3z" />
                      <path d="M8 1v4h4" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                  <button
                    class={`grid-size-btn ${gridSize() === "double" ? "active" : ""}`}
                    onClick={() => { setGridSize("double"); storeGridSize("double"); }}
                    title="Two columns"
                  >
                    <svg width="24" height="18" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M1 3a2 2 0 012-2h3l3 3v10a2 2 0 01-2 2H3a2 2 0 01-2-2V3z" />
                      <path d="M6 1v3h3" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M14 3a2 2 0 012-2h3l3 3v10a2 2 0 01-2 2h-4a2 2 0 01-2-2V3z" />
                      <path d="M19 1v3h3" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>
              </Show>
              <button class="close-btn" onClick={props.onClose}>×</button>
            </div>
          </div>

          <div class="page-overview-body">
            {/* TOC Tab */}
            <Show when={activeTab() === "toc"}>
              <nav class="toc-list">
                <For each={tocItems()}>
                  {(item, index) => (
                    <a
                      class={`toc-item toc-level-${item.level} ${index() === getActiveTocIndex() ? "active" : ""}`}
                      onClick={() => handleTocClick(item)}
                      title={item.text}
                    >
                      <span class="toc-item-text">{item.text}</span>
                    </a>
                  )}
                </For>
              </nav>
            </Show>

            {/* Pages Tab */}
            <Show when={activeTab() === "pages"}>
              <div class="page-overview-content">
                <Show when={error()}>
                  <div class="page-overview-error">{error()}</div>
                </Show>

                <div class={`page-overview-grid ${gridSize() === "double" ? "grid-double" : ""}`}>
                  {/* Show skeleton placeholders for pages not yet loaded */}
                  <For each={Array.from({ length: expectedPageCount() }, (_, i) => i)}>
                    {(index) => {
                      const thumb = () => thumbnails().find(t => t.index === index);
                      return (
                        <Show 
                          when={thumb()} 
                          fallback={
                            <div class="page-thumb skeleton">
                              <div class="skeleton-shimmer" />
                              <span class="page-number">{index + 1}</span>
                            </div>
                          }
                        >
                          <div
                            class={`page-thumb ${index === getActivePageIndex() ? "active" : ""}`}
                            onClick={() => handlePageClick(thumb()!)}
                          >
                            <img src={thumb()!.dataUrl} alt={`Page ${index + 1}`} />
                            <span class="page-number">{index + 1}</span>
                          </div>
                        </Show>
                      );
                    }}
                  </For>
                </div>

                <Show when={loading()}>
                  <div class="page-overview-progress">
                    Generating previews...
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
