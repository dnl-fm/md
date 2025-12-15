/**
 * Page overview panel - slide-in from right with TOC.
 * Page thumbnails are feature-flagged off until scroll mapping is fixed.
 */
import { Show, For, createSignal, createEffect } from "solid-js";
import { content, config } from "../stores/app-store";

// Feature flag: disable page previews until scroll position mapping is fixed
const ENABLE_PAGE_PREVIEWS = false;

interface PageOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentElement: HTMLElement | null;
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
  // Force TOC when previews disabled
  if (!ENABLE_PAGE_PREVIEWS) return "toc";
  return stored === "pages" ? "pages" : "toc";
}
function storeTab(tab: TabType) {
  localStorage.setItem(STORAGE_KEY, tab);
}

// Stubs for external API compatibility
export function onPreRenderStatus(_listener: (isRendering: boolean) => void): () => void {
  return () => {};
}

export async function preRenderThumbnails(
  _contentElement: HTMLElement | null,
  _contentStr: string,
  _theme: string
): Promise<void> {
  // Feature-flagged off
}

export function PageOverviewModal(props: PageOverviewModalProps) {
  const [activeTab, setActiveTab] = createSignal<TabType>(getStoredTab());
  const [tocItems, setTocItems] = createSignal<TocItem[]>([]);
  const [currentScrollY, setCurrentScrollY] = createSignal(0);
  
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

  // Extract TOC when modal opens
  createEffect(() => {
    const isOpen = props.isOpen;
    const el = props.contentElement;
    const currentContent = content();
    void config().theme; // Track theme changes to re-extract TOC
    
    if (!isOpen || !el || !currentContent) return;
    
    extractToc();
  });

  function switchTab(tab: TabType) {
    setActiveTab(tab);
    storeTab(tab);
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
              <Show when={ENABLE_PAGE_PREVIEWS}>
                <button
                  class={`tab-btn ${activeTab() === "pages" ? "active" : ""}`}
                  onClick={() => switchTab("pages")}
                >
                  Pages
                </button>
              </Show>
            </div>
            <div class="page-overview-actions">
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
          </div>
        </div>
      </div>
    </Show>
  );
}
