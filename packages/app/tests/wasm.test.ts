/**
 * Tests for WASM editor module
 * 
 * Run with: bun test tests/wasm.test.ts
 */
import { describe, it, expect, beforeAll } from "bun:test";

// Import WASM module
let wasm: typeof import("../src/wasm-pkg/md_editor");

beforeAll(async () => {
  wasm = await import("../src/wasm-pkg/md_editor");
  await wasm.default();
});

describe("WASM Editor", () => {
  describe("Phase 1: Basic Integration", () => {
    it("should load and execute hello()", () => {
      expect(wasm.hello()).toBe("WASM works!");
    });
  });

  describe("Phase 2: Text Buffer", () => {
    it("should set and get content", () => {
      wasm.set_content("Hello, World!");
      expect(wasm.get_content()).toBe("Hello, World!");
    });

    it("should count lines correctly", () => {
      wasm.set_content("Line 1\nLine 2\nLine 3");
      expect(wasm.line_count()).toBe(3);
    });

    it("should count characters correctly", () => {
      wasm.set_content("Hello");
      expect(wasm.char_count()).toBe(5);
    });

    it("should get individual lines", () => {
      wasm.set_content("First\nSecond\nThird");
      expect(wasm.get_line(0)).toBe("First\n");
      expect(wasm.get_line(1)).toBe("Second\n");
      expect(wasm.get_line(2)).toBe("Third");
    });

    it("should insert text at position", () => {
      wasm.set_content("Hello World");
      wasm.insert_at(5, ", Beautiful");
      expect(wasm.get_content()).toBe("Hello, Beautiful World");
    });

    it("should delete text range", () => {
      wasm.set_content("Hello, Beautiful World");
      wasm.delete_range(5, 16);
      expect(wasm.get_content()).toBe("Hello World");
    });
  });

  describe("Phase 3: Line Rendering", () => {
    it("should get visible lines", () => {
      wasm.set_content("Line 1\nLine 2\nLine 3\nLine 4\nLine 5");
      const lines = wasm.get_visible_lines(0, 3);
      expect(lines).toHaveLength(3);
      expect(lines[0].num).toBe(1);
      expect(lines[0].content).toBe("Line 1");
      expect(lines[2].num).toBe(3);
    });
  });

  describe("Phase 5: Syntax Highlighting", () => {
    it("should highlight headings", () => {
      wasm.set_content("# Heading 1\n## Heading 2");
      const lines = wasm.get_highlighted_lines(0, 2);
      expect(lines[0].spans[0].style).toContain("heading");
      expect(lines[0].spans[0].style).toContain("h1");
      expect(lines[1].spans[0].style).toContain("h2");
    });

    it("should highlight code blocks", () => {
      wasm.set_content("```javascript\nconst x = 1;\n```");
      wasm.reset_highlighting_state();
      const lines = wasm.get_highlighted_lines(0, 3);
      expect(lines[0].spans[0].style).toBe("code-fence");
      // Line 1 should have syntax highlighting - "const" is a keyword
      expect(lines[1].spans[0].style).toBe("code-keyword");
      expect(lines[1].spans[0].text).toBe("const");
      expect(lines[2].spans[0].style).toBe("code-fence");
    });

    it("should highlight inline code", () => {
      wasm.set_content("Use `const` for constants");
      const lines = wasm.get_highlighted_lines(0, 1);
      const spans = lines[0].spans;
      const codeSpan = spans.find((s: any) => s.style === "inline-code");
      expect(codeSpan).toBeDefined();
      expect(codeSpan.text).toBe("`const`");
    });

    it("should highlight bold text", () => {
      wasm.set_content("This is **bold** text");
      const lines = wasm.get_highlighted_lines(0, 1);
      const spans = lines[0].spans;
      const boldSpan = spans.find((s: any) => s.style === "bold");
      expect(boldSpan).toBeDefined();
      expect(boldSpan.text).toBe("**bold**");
    });

    it("should highlight links", () => {
      wasm.set_content("Click [here](https://example.com)");
      const lines = wasm.get_highlighted_lines(0, 1);
      const spans = lines[0].spans;
      const linkSpan = spans.find((s: any) => s.style === "link");
      expect(linkSpan).toBeDefined();
      expect(linkSpan.text).toBe("[here](https://example.com)");
    });

    it("should highlight list markers", () => {
      wasm.set_content("- Item 1\n* Item 2\n1. Numbered");
      const lines = wasm.get_highlighted_lines(0, 3);
      expect(lines[0].spans.some((s: any) => s.style === "list-marker")).toBe(true);
      expect(lines[1].spans.some((s: any) => s.style === "list-marker")).toBe(true);
      expect(lines[2].spans.some((s: any) => s.style === "list-marker")).toBe(true);
    });
  });

  describe("Phase 6: Cursor & Selection", () => {
    it("should set and get cursor position", () => {
      wasm.set_content("Hello World");
      wasm.set_cursor(5);
      expect(wasm.get_cursor()).toBe(5);
    });

    it("should get cursor line and column", () => {
      wasm.set_content("First\nSecond\nThird");
      wasm.set_cursor(8); // "Se|cond"
      const pos = wasm.get_cursor_position();
      expect(pos.line).toBe(1);
      expect(pos.col).toBe(2);
    });

    it("should set and get selection", () => {
      wasm.set_content("Hello World");
      wasm.set_selection(0, 5);
      const selection = wasm.get_selection();
      expect(selection).toEqual([0, 5]);
    });

    it("should get selected text", () => {
      wasm.set_content("Hello World");
      wasm.set_selection(0, 5);
      expect(wasm.get_selected_text()).toBe("Hello");
    });

    it("should clear selection", () => {
      wasm.set_content("Hello World");
      wasm.set_selection(0, 5);
      wasm.clear_selection();
      // Returns undefined when no selection (JS representation of Rust None)
      expect(wasm.get_selection()).toBeUndefined();
    });

    it("should convert line/col to offset", () => {
      wasm.set_content("First\nSecond\nThird");
      expect(wasm.line_col_to_offset(0, 0)).toBe(0);
      expect(wasm.line_col_to_offset(1, 0)).toBe(6); // Start of "Second"
      expect(wasm.line_col_to_offset(1, 3)).toBe(9); // "Sec|ond"
    });

    it("should get line start and end", () => {
      wasm.set_content("First\nSecond\nThird");
      expect(wasm.get_line_start(0)).toBe(0);
      expect(wasm.get_line_end(0)).toBe(5); // Before \n
      expect(wasm.get_line_start(1)).toBe(6);
      expect(wasm.get_line_end(1)).toBe(12);
    });
  });

  describe("Phase 7: Undo/Redo", () => {
    it("should save and undo state", () => {
      wasm.clear_undo_redo();
      wasm.set_content("Initial");
      wasm.save_undo_state();
      wasm.set_content("Modified");
      
      expect(wasm.can_undo()).toBe(true);
      expect(wasm.can_redo()).toBe(false);
      
      wasm.undo();
      expect(wasm.get_content()).toBe("Initial");
    });

    it("should redo after undo", () => {
      wasm.clear_undo_redo();
      wasm.set_content("Initial");
      wasm.save_undo_state();
      wasm.set_content("Modified");
      
      wasm.undo();
      expect(wasm.can_redo()).toBe(true);
      
      wasm.redo();
      expect(wasm.get_content()).toBe("Modified");
    });

    it("should clear redo stack on new change", () => {
      wasm.clear_undo_redo();
      wasm.set_content("V1");
      wasm.save_undo_state();
      wasm.set_content("V2");
      
      wasm.undo();
      wasm.save_undo_state();
      wasm.set_content("V3");
      
      expect(wasm.can_redo()).toBe(false);
    });
  });

  describe("Utility functions", () => {
    it("should replace range and return new cursor", () => {
      wasm.set_content("Hello World");
      const newPos = wasm.replace_range(6, 11, "Universe");
      expect(wasm.get_content()).toBe("Hello Universe");
      expect(newPos).toBe(14); // After "Universe"
    });
  });
});
