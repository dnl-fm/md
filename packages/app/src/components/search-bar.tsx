/**
 * Search bar component for finding text in markdown content.
 * Appears at the top of the markdown viewer when Ctrl+F is pressed.
 */
import { createEffect } from "solid-js";
import {
  showSearch,
  setShowSearch,
  searchQuery,
  setSearchQuery,
  searchMatches,
  currentMatch,
} from "../stores/app-store";

/** Props for SearchBar component */
interface SearchBarProps {
  /** Callback to navigate between search matches */
  onNavigate: (direction: "next" | "prev") => void;
}

/**
 * Search bar with input, match counter, and navigation buttons.
 * Keyboard shortcuts:
 * - Enter: next match
 * - Shift+Enter: previous match
 * - Escape: close search
 */
export function SearchBar(props: SearchBarProps) {
  let inputRef: HTMLInputElement | undefined;

  // Focus input when search opens
  createEffect(() => {
    if (showSearch() && inputRef) {
      inputRef.focus();
      inputRef.select();
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setShowSearch(false);
      setSearchQuery("");
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        props.onNavigate("prev");
      } else {
        props.onNavigate("next");
      }
    }
  }

  return (
    <div class={`search-bar ${showSearch() ? "visible" : ""}`}>
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="currentColor"
            d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          class="search-input"
          placeholder="Search..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
        <span class="search-count">
          {searchMatches() > 0 ? `${currentMatch()}/${searchMatches()}` : "0/0"}
        </span>
      </div>
      <div class="search-nav">
        <button
          class="search-nav-btn"
          onClick={() => props.onNavigate("prev")}
          disabled={searchMatches() === 0}
          title="Previous (Shift+Enter)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          </svg>
        </button>
        <button
          class="search-nav-btn"
          onClick={() => props.onNavigate("next")}
          disabled={searchMatches() === 0}
          title="Next (Enter)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
        <button
          class="search-nav-btn search-close"
          onClick={() => {
            setShowSearch(false);
            setSearchQuery("");
          }}
          title="Close (Esc)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
