import { Show } from "solid-js";
import {
  content,
  setContent,
  renderedHtml,
  showRawMarkdown,
  markdownFontSize,
  markdownFontFamily,
} from "../stores/app-store";
import { getFontFamilyCSS } from "../utils";
import { EmptyState } from "./empty-state";

interface MarkdownViewerProps {
  onSaveAndPreview: () => void;
}

export function MarkdownViewer(props: MarkdownViewerProps) {
  return (
    <div class="markdown-container">
      <Show when={content()} fallback={<EmptyState />}>
        <Show when={showRawMarkdown()}>
          <textarea
            class="markdown-raw markdown-editor"
            style={{
              "font-size": `${markdownFontSize()}px`,
              "font-family": getFontFamilyCSS(markdownFontFamily()),
            }}
            value={content()}
            onInput={(e) => setContent(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                props.onSaveAndPreview();
              }
            }}
            spellcheck={false}
          />
        </Show>
        <Show when={!showRawMarkdown()}>
          <article
            class="markdown-content markdown-body"
            innerHTML={renderedHtml()}
            style={{
              "font-size": `${markdownFontSize()}px`,
              "font-family": getFontFamilyCSS(markdownFontFamily()),
            }}
          />
        </Show>
      </Show>
    </div>
  );
}
