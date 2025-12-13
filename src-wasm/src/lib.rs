use ropey::Rope;
use serde::Serialize;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;

// ============================================================================
// Phase 1: Basic WASM Integration
// ============================================================================

#[wasm_bindgen]
pub fn hello() -> String {
    "WASM works!".to_string()
}

// ============================================================================
// Phase 2: Text Buffer (using ropey for efficient text handling)
// ============================================================================

thread_local! {
    static BUFFER: RefCell<Rope> = RefCell::new(Rope::new());
    static CURSOR: RefCell<usize> = RefCell::new(0);
    static SELECTION: RefCell<Option<(usize, usize)>> = RefCell::new(None);
    static UNDO_STACK: RefCell<Vec<(String, usize)>> = RefCell::new(Vec::new());
    static REDO_STACK: RefCell<Vec<(String, usize)>> = RefCell::new(Vec::new());
}

#[wasm_bindgen]
pub fn set_content(text: &str) {
    BUFFER.with(|b| {
        *b.borrow_mut() = Rope::from_str(text);
    });
}

#[wasm_bindgen]
pub fn get_content() -> String {
    BUFFER.with(|b| b.borrow().to_string())
}

#[wasm_bindgen]
pub fn insert_at(pos: usize, text: &str) {
    BUFFER.with(|b| {
        let mut rope = b.borrow_mut();
        let pos = pos.min(rope.len_chars());
        rope.insert(pos, text);
    });
}

#[wasm_bindgen]
pub fn delete_range(start: usize, end: usize) {
    BUFFER.with(|b| {
        let mut rope = b.borrow_mut();
        let start = start.min(rope.len_chars());
        let end = end.min(rope.len_chars());
        if start < end {
            rope.remove(start..end);
        }
    });
}

#[wasm_bindgen]
pub fn line_count() -> usize {
    BUFFER.with(|b| b.borrow().len_lines())
}

#[wasm_bindgen]
pub fn char_count() -> usize {
    BUFFER.with(|b| b.borrow().len_chars())
}

#[wasm_bindgen]
pub fn get_line(idx: usize) -> String {
    BUFFER.with(|b| {
        let rope = b.borrow();
        if idx < rope.len_lines() {
            rope.line(idx).to_string()
        } else {
            String::new()
        }
    })
}

// ============================================================================
// Phase 3: Line Rendering
// ============================================================================

#[derive(Serialize)]
pub struct Line {
    pub num: usize,
    pub content: String,
}

#[wasm_bindgen]
pub fn get_visible_lines(start: usize, count: usize) -> JsValue {
    BUFFER.with(|b| {
        let rope = b.borrow();
        let total = rope.len_lines();
        let start = start.min(total);
        let end = (start + count).min(total);

        let lines: Vec<Line> = (start..end)
            .map(|i| Line {
                num: i + 1,
                content: rope.line(i).to_string().trim_end_matches('\n').to_string(),
            })
            .collect();

        serde_wasm_bindgen::to_value(&lines).unwrap_or(JsValue::NULL)
    })
}

// ============================================================================
// Phase 5: Syntax Highlighting (regex-based for MVP)
// ============================================================================

#[derive(Serialize, Clone)]
pub struct Span {
    pub text: String,
    pub style: String,
}

#[derive(Serialize)]
pub struct HighlightedLine {
    pub num: usize,
    pub spans: Vec<Span>,
}

// Track code block state
thread_local! {
    static IN_CODE_BLOCK: RefCell<bool> = RefCell::new(false);
    static CODE_BLOCK_LANG: RefCell<String> = RefCell::new(String::new());
}

fn highlight_line(content: &str, in_code_block: &mut bool, code_lang: &mut String) -> Vec<Span> {
    let mut spans = Vec::new();

    // Check for code block start/end
    if content.trim_start().starts_with("```") {
        if *in_code_block {
            // End of code block
            *in_code_block = false;
            *code_lang = String::new();
            spans.push(Span {
                text: content.to_string(),
                style: "code-fence".to_string(),
            });
        } else {
            // Start of code block
            *in_code_block = true;
            let trimmed = content.trim_start();
            *code_lang = trimmed[3..].trim().to_string();
            spans.push(Span {
                text: content.to_string(),
                style: "code-fence".to_string(),
            });
        }
        return spans;
    }

    // Inside code block - don't parse markdown
    if *in_code_block {
        spans.push(Span {
            text: content.to_string(),
            style: "code-block".to_string(),
        });
        return spans;
    }

    // Empty line
    if content.is_empty() {
        spans.push(Span {
            text: String::new(),
            style: "text".to_string(),
        });
        return spans;
    }

    // Headings
    if content.starts_with('#') {
        let level = content.chars().take_while(|c| *c == '#').count();
        if level <= 6 && content.chars().nth(level) == Some(' ') {
            spans.push(Span {
                text: content.to_string(),
                style: format!("heading h{}", level),
            });
            return spans;
        }
    }

    // Blockquote
    if content.starts_with('>') {
        spans.push(Span {
            text: content.to_string(),
            style: "blockquote".to_string(),
        });
        return spans;
    }

    // Horizontal rule
    let trimmed = content.trim();
    if trimmed == "---" || trimmed == "***" || trimmed == "___" {
        spans.push(Span {
            text: content.to_string(),
            style: "hr".to_string(),
        });
        return spans;
    }

    // List items (unordered)
    if content.trim_start().starts_with("- ")
        || content.trim_start().starts_with("* ")
        || content.trim_start().starts_with("+ ")
    {
        let indent = content.len() - content.trim_start().len();
        spans.push(Span {
            text: " ".repeat(indent),
            style: "text".to_string(),
        });
        // Include the marker AND the space after it
        spans.push(Span {
            text: content.trim_start()[..2].to_string(),
            style: "list-marker".to_string(),
        });
        let rest = &content.trim_start()[2..];
        spans.extend(parse_inline(rest));
        return spans;
    }

    // List items (ordered)
    let trimmed_start = content.trim_start();
    if let Some(dot_pos) = trimmed_start.find(". ") {
        if trimmed_start[..dot_pos].chars().all(|c| c.is_ascii_digit()) {
            let indent = content.len() - content.trim_start().len();
            spans.push(Span {
                text: " ".repeat(indent),
                style: "text".to_string(),
            });
            spans.push(Span {
                text: trimmed_start[..=dot_pos].to_string(),
                style: "list-marker".to_string(),
            });
            let rest = &trimmed_start[dot_pos + 2..];
            spans.extend(parse_inline(rest));
            return spans;
        }
    }

    // Table row detection
    if content.contains('|') {
        spans.push(Span {
            text: content.to_string(),
            style: "table".to_string(),
        });
        return spans;
    }

    // Regular text with inline formatting
    spans.extend(parse_inline(content));
    spans
}

fn parse_inline(text: &str) -> Vec<Span> {
    let mut spans = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut current = String::new();
    let mut i = 0;

    while i < chars.len() {
        // Inline code
        if chars[i] == '`' {
            if !current.is_empty() {
                spans.push(Span {
                    text: current.clone(),
                    style: "text".to_string(),
                });
                current.clear();
            }

            let start = i;
            i += 1;
            let mut code_content = String::new();
            while i < chars.len() && chars[i] != '`' {
                code_content.push(chars[i]);
                i += 1;
            }
            if i < chars.len() {
                i += 1; // skip closing `
                spans.push(Span {
                    text: format!("`{}`", code_content),
                    style: "inline-code".to_string(),
                });
            } else {
                // No closing `, treat as regular text
                current.push('`');
                current.push_str(&code_content);
                i = start + 1;
                continue;
            }
            continue;
        }

        // Bold (**text**)
        if i + 1 < chars.len() && chars[i] == '*' && chars[i + 1] == '*' {
            if !current.is_empty() {
                spans.push(Span {
                    text: current.clone(),
                    style: "text".to_string(),
                });
                current.clear();
            }

            i += 2;
            let mut bold_content = String::new();
            while i + 1 < chars.len() && !(chars[i] == '*' && chars[i + 1] == '*') {
                bold_content.push(chars[i]);
                i += 1;
            }
            if i + 1 < chars.len() {
                i += 2; // skip closing **
                spans.push(Span {
                    text: format!("**{}**", bold_content),
                    style: "bold".to_string(),
                });
            } else {
                current.push_str("**");
                current.push_str(&bold_content);
            }
            continue;
        }

        // Italic (*text* or _text_)
        if chars[i] == '*' || chars[i] == '_' {
            let marker = chars[i];
            if !current.is_empty() {
                spans.push(Span {
                    text: current.clone(),
                    style: "text".to_string(),
                });
                current.clear();
            }

            i += 1;
            let mut italic_content = String::new();
            while i < chars.len() && chars[i] != marker {
                italic_content.push(chars[i]);
                i += 1;
            }
            if i < chars.len() && !italic_content.is_empty() {
                i += 1; // skip closing marker
                spans.push(Span {
                    text: format!("{}{}{}", marker, italic_content, marker),
                    style: "italic".to_string(),
                });
            } else {
                current.push(marker);
                current.push_str(&italic_content);
            }
            continue;
        }

        // Links [text](url)
        if chars[i] == '[' {
            if !current.is_empty() {
                spans.push(Span {
                    text: current.clone(),
                    style: "text".to_string(),
                });
                current.clear();
            }

            let start = i;
            i += 1;
            let mut link_text = String::new();
            while i < chars.len() && chars[i] != ']' {
                link_text.push(chars[i]);
                i += 1;
            }

            if i + 1 < chars.len() && chars[i] == ']' && chars[i + 1] == '(' {
                i += 2;
                let mut link_url = String::new();
                while i < chars.len() && chars[i] != ')' {
                    link_url.push(chars[i]);
                    i += 1;
                }
                if i < chars.len() {
                    i += 1;
                    spans.push(Span {
                        text: format!("[{}]({})", link_text, link_url),
                        style: "link".to_string(),
                    });
                    continue;
                }
            }
            // Not a valid link, backtrack
            current.push('[');
            i = start + 1;
            continue;
        }

        current.push(chars[i]);
        i += 1;
    }

    if !current.is_empty() {
        spans.push(Span {
            text: current,
            style: "text".to_string(),
        });
    }

    spans
}

#[wasm_bindgen]
pub fn get_highlighted_lines(start: usize, count: usize) -> JsValue {
    BUFFER.with(|b| {
        let rope = b.borrow();
        let total = rope.len_lines();
        let start = start.min(total);
        let end = (start + count).min(total);

        // Track code block state across lines
        let mut in_code_block = false;
        let mut code_lang = String::new();

        // First, process all lines from the beginning to track code block state
        for i in 0..start {
            let line_content = rope.line(i).to_string();
            let trimmed = line_content.trim_start();
            if trimmed.starts_with("```") {
                if in_code_block {
                    in_code_block = false;
                    code_lang.clear();
                } else {
                    in_code_block = true;
                    code_lang = trimmed[3..].trim().to_string();
                }
            }
        }

        let lines: Vec<HighlightedLine> = (start..end)
            .map(|i| {
                let content = rope.line(i).to_string().trim_end_matches('\n').to_string();
                let spans = highlight_line(&content, &mut in_code_block, &mut code_lang);
                HighlightedLine { num: i + 1, spans }
            })
            .collect();

        serde_wasm_bindgen::to_value(&lines).unwrap_or(JsValue::NULL)
    })
}

// Reset code block tracking (call when loading new content)
#[wasm_bindgen]
pub fn reset_highlighting_state() {
    IN_CODE_BLOCK.with(|f| *f.borrow_mut() = false);
    CODE_BLOCK_LANG.with(|f| *f.borrow_mut() = String::new());
}

// ============================================================================
// Phase 6: Cursor & Selection
// ============================================================================

#[wasm_bindgen]
pub fn set_cursor(pos: usize) {
    CURSOR.with(|c| {
        BUFFER.with(|b| {
            let max_pos = b.borrow().len_chars();
            *c.borrow_mut() = pos.min(max_pos);
        });
    });
}

#[wasm_bindgen]
pub fn get_cursor() -> usize {
    CURSOR.with(|c| *c.borrow())
}

#[derive(Serialize)]
pub struct CursorPosition {
    pub line: usize,
    pub col: usize,
    pub offset: usize,
}

#[wasm_bindgen]
pub fn get_cursor_position() -> JsValue {
    BUFFER.with(|b| {
        CURSOR.with(|c| {
            let rope = b.borrow();
            let cursor = *c.borrow();
            let cursor = cursor.min(rope.len_chars());

            let line = rope.char_to_line(cursor);
            let line_start = rope.line_to_char(line);
            let col = cursor - line_start;

            serde_wasm_bindgen::to_value(&CursorPosition {
                line,
                col,
                offset: cursor,
            })
            .unwrap_or(JsValue::NULL)
        })
    })
}

#[wasm_bindgen]
pub fn set_selection(start: usize, end: usize) {
    SELECTION.with(|s| {
        BUFFER.with(|b| {
            let max_pos = b.borrow().len_chars();
            let start = start.min(max_pos);
            let end = end.min(max_pos);
            *s.borrow_mut() = Some((start.min(end), start.max(end)));
        });
    });
}

#[wasm_bindgen]
pub fn clear_selection() {
    SELECTION.with(|s| {
        *s.borrow_mut() = None;
    });
}

#[wasm_bindgen]
pub fn get_selection() -> JsValue {
    SELECTION.with(|s| serde_wasm_bindgen::to_value(&*s.borrow()).unwrap_or(JsValue::NULL))
}

#[wasm_bindgen]
pub fn get_selected_text() -> Option<String> {
    SELECTION.with(|s| {
        s.borrow().map(|(start, end)| {
            BUFFER.with(|b| {
                let rope = b.borrow();
                let start = start.min(rope.len_chars());
                let end = end.min(rope.len_chars());
                rope.slice(start..end).to_string()
            })
        })
    })
}

// Convert line/column to character offset
#[wasm_bindgen]
pub fn line_col_to_offset(line: usize, col: usize) -> usize {
    BUFFER.with(|b| {
        let rope = b.borrow();
        if line >= rope.len_lines() {
            return rope.len_chars();
        }
        let line_start = rope.line_to_char(line);
        let line_content = rope.line(line).to_string();
        // Allow positioning at EOL: exclude newline from length but allow cursor after last char
        let line_len_without_newline = line_content.trim_end_matches('\n').len();
        line_start + col.min(line_len_without_newline)
    })
}

// ============================================================================
// Phase 7: Undo/Redo
// ============================================================================

const MAX_UNDO_STACK: usize = 100;

#[wasm_bindgen]
pub fn save_undo_state() {
    let content = get_content();
    let cursor = get_cursor();
    UNDO_STACK.with(|undo| {
        let mut stack = undo.borrow_mut();
        // Don't save if identical to last state
        if stack.last().map(|(c, _)| c.as_str()) != Some(content.as_str()) {
            stack.push((content, cursor));
            if stack.len() > MAX_UNDO_STACK {
                stack.remove(0);
            }
        }
    });
    REDO_STACK.with(|redo| redo.borrow_mut().clear());
}

#[wasm_bindgen]
pub fn undo() -> bool {
    UNDO_STACK.with(|undo| {
        let mut stack = undo.borrow_mut();
        if let Some((prev_content, prev_cursor)) = stack.pop() {
            // Save current state to redo
            let current = get_content();
            let current_cursor = get_cursor();
            REDO_STACK.with(|redo| redo.borrow_mut().push((current, current_cursor)));

            // Restore previous state
            set_content(&prev_content);
            set_cursor(prev_cursor);
            true
        } else {
            false
        }
    })
}

#[wasm_bindgen]
pub fn redo() -> bool {
    REDO_STACK.with(|redo| {
        let mut stack = redo.borrow_mut();
        if let Some((next_content, next_cursor)) = stack.pop() {
            // Save current state to undo
            let current = get_content();
            let current_cursor = get_cursor();
            UNDO_STACK.with(|undo| undo.borrow_mut().push((current, current_cursor)));

            // Restore next state
            set_content(&next_content);
            set_cursor(next_cursor);
            true
        } else {
            false
        }
    })
}

#[wasm_bindgen]
pub fn can_undo() -> bool {
    UNDO_STACK.with(|undo| !undo.borrow().is_empty())
}

#[wasm_bindgen]
pub fn can_redo() -> bool {
    REDO_STACK.with(|redo| !redo.borrow().is_empty())
}

#[wasm_bindgen]
pub fn clear_undo_redo() {
    UNDO_STACK.with(|undo| undo.borrow_mut().clear());
    REDO_STACK.with(|redo| redo.borrow_mut().clear());
}

// ============================================================================
// Utility functions
// ============================================================================

/// Get line start offset for a given line number (0-indexed)
#[wasm_bindgen]
pub fn get_line_start(line: usize) -> usize {
    BUFFER.with(|b| {
        let rope = b.borrow();
        if line >= rope.len_lines() {
            rope.len_chars()
        } else {
            rope.line_to_char(line)
        }
    })
}

/// Get line end offset for a given line number (0-indexed)
#[wasm_bindgen]
pub fn get_line_end(line: usize) -> usize {
    BUFFER.with(|b| {
        let rope = b.borrow();
        if line >= rope.len_lines() {
            rope.len_chars()
        } else {
            let line_start = rope.line_to_char(line);
            let line_content = rope.line(line);
            let line_len = line_content.len_chars();
            // Don't include the trailing newline
            if line_len > 0
                && line_content
                    .chars()
                    .last()
                    .map(|c| c == '\n')
                    .unwrap_or(false)
            {
                line_start + line_len - 1
            } else {
                line_start + line_len
            }
        }
    })
}

/// Replace a range with new text and return new cursor position
#[wasm_bindgen]
pub fn replace_range(start: usize, end: usize, text: &str) -> usize {
    BUFFER.with(|b| {
        let mut rope = b.borrow_mut();
        let start = start.min(rope.len_chars());
        let end = end.min(rope.len_chars());

        if start < end {
            rope.remove(start..end);
        }
        rope.insert(start, text);

        // Return new cursor position (after inserted text)
        start + text.chars().count()
    })
}
