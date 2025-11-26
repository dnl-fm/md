import { describe, expect, test } from "bun:test";
import {
  getFontFamilyCSS,
  getFilename,
  formatFileSize,
  escapeHtml,
  slugify,
  clamp,
  calculateSidebarWidth,
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
  FONT_OPTIONS,
} from "../src/utils";

describe("getFontFamilyCSS", () => {
  test("returns system font stack for 'system'", () => {
    const result = getFontFamilyCSS("system");
    expect(result).toContain("-apple-system");
    expect(result).toContain("BlinkMacSystemFont");
    expect(result).toContain("sans-serif");
  });

  test("returns custom font with fallbacks", () => {
    const result = getFontFamilyCSS("JetBrains Mono");
    expect(result).toContain('"JetBrains Mono"');
    expect(result).toContain("monospace");
  });

  test("wraps custom font name in quotes", () => {
    const result = getFontFamilyCSS("Fira Code");
    expect(result.startsWith('"Fira Code"')).toBe(true);
  });
});

describe("getFilename", () => {
  test("extracts filename from Unix path", () => {
    expect(getFilename("/home/user/documents/readme.md")).toBe("readme.md");
  });

  test("extracts filename from nested path", () => {
    expect(getFilename("/a/b/c/d/file.txt")).toBe("file.txt");
  });

  test("returns full string if no slashes", () => {
    expect(getFilename("file.md")).toBe("file.md");
  });

  test("handles trailing slash correctly", () => {
    // Returns the full path when split results in empty string
    expect(getFilename("/path/to/dir/")).toBe("/path/to/dir/");
  });

  test("handles empty string", () => {
    expect(getFilename("")).toBe("");
  });
});

describe("formatFileSize", () => {
  test("formats bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(100)).toBe("100 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  test("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10240)).toBe("10.0 KB");
  });

  test("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
    expect(formatFileSize(1024 * 1024 * 100)).toBe("100.0 MB");
  });
});

describe("escapeHtml", () => {
  test("escapes ampersand", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  test("escapes less than", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  test("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    expect(escapeHtml("'hello'")).toBe("&#039;hello&#039;");
  });

  test("escapes multiple characters", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
  });

  test("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

  test("passes through safe text unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});

describe("slugify", () => {
  test("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("replaces spaces with hyphens", () => {
    expect(slugify("foo bar baz")).toBe("foo-bar-baz");
  });

  test("removes special characters", () => {
    expect(slugify("Hello! How are you?")).toBe("hello-how-are-you");
  });

  test("collapses multiple hyphens", () => {
    expect(slugify("foo   bar")).toBe("foo-bar");
    expect(slugify("foo---bar")).toBe("foo-bar");
  });

  test("handles unicode/special chars", () => {
    expect(slugify("Café & Restaurant")).toBe("caf-restaurant");
  });

  test("trims whitespace", () => {
    expect(slugify("  hello world  ")).toBe("hello-world");
  });
});

describe("clamp", () => {
  test("returns value when in range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test("clamps to min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  test("clamps to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  test("handles edge cases", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("calculateSidebarWidth", () => {
  test("returns minimum width for empty history", () => {
    expect(calculateSidebarWidth([])).toBe(180);
  });

  test("calculates width based on longest filename", () => {
    const history = ["/path/to/short.md", "/path/to/much-longer-filename.md"];
    const result = calculateSidebarWidth(history);
    expect(result).toBeGreaterThan(180);
    expect(result).toBeLessThanOrEqual(400);
  });

  test("respects maximum width", () => {
    const history = [
      "/path/to/a-very-very-very-very-very-very-very-long-filename-that-exceeds-limits.md",
    ];
    expect(calculateSidebarWidth(history)).toBe(400);
  });

  test("respects minimum width for short filenames", () => {
    const history = ["/a.md"];
    expect(calculateSidebarWidth(history)).toBe(180);
  });
});

describe("constants", () => {
  test("DEFAULT_DARK_COLORS has all required keys", () => {
    const requiredKeys = [
      "bg_primary",
      "bg_secondary",
      "text_primary",
      "text_link",
      "accent_color",
    ];
    requiredKeys.forEach((key) => {
      expect(DEFAULT_DARK_COLORS).toHaveProperty(key);
    });
  });

  test("DEFAULT_LIGHT_COLORS has all required keys", () => {
    const requiredKeys = [
      "bg_primary",
      "bg_secondary",
      "text_primary",
      "text_link",
      "accent_color",
    ];
    requiredKeys.forEach((key) => {
      expect(DEFAULT_LIGHT_COLORS).toHaveProperty(key);
    });
  });

  test("FONT_OPTIONS includes system default", () => {
    const hasSystem = FONT_OPTIONS.some((opt) => opt.value === "system");
    expect(hasSystem).toBe(true);
  });

  test("FONT_OPTIONS has correct structure", () => {
    FONT_OPTIONS.forEach((opt) => {
      expect(opt).toHaveProperty("value");
      expect(opt).toHaveProperty("label");
      expect(typeof opt.value).toBe("string");
      expect(typeof opt.label).toBe("string");
    });
  });
});
