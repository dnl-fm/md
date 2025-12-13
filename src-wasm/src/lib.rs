use ropey::Rope;
use serde::Serialize;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;

// ============================================================================
// Phase 1: Basic WASM Integration
// ============================================================================

/// Test function to verify WASM module is loaded correctly.
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

/// Set the entire buffer content, replacing any existing text.
#[wasm_bindgen]
pub fn set_content(text: &str) {
    BUFFER.with(|b| {
        *b.borrow_mut() = Rope::from_str(text);
    });
}

/// Get the entire buffer content as a string.
#[wasm_bindgen]
pub fn get_content() -> String {
    BUFFER.with(|b| b.borrow().to_string())
}

/// Insert text at the specified character position.
#[wasm_bindgen]
pub fn insert_at(pos: usize, text: &str) {
    BUFFER.with(|b| {
        let mut rope = b.borrow_mut();
        let pos = pos.min(rope.len_chars());
        rope.insert(pos, text);
    });
}

/// Delete text between start and end character positions.
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

/// Get the total number of lines in the buffer.
#[wasm_bindgen]
pub fn line_count() -> usize {
    BUFFER.with(|b| b.borrow().len_lines())
}

/// Get the total number of characters in the buffer.
#[wasm_bindgen]
pub fn char_count() -> usize {
    BUFFER.with(|b| b.borrow().len_chars())
}

/// Get the content of a specific line by index (0-based).
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

/// A single line with its line number and content.
#[derive(Serialize)]
pub struct Line {
    /// 1-based line number
    pub num: usize,
    /// Line content without trailing newline
    pub content: String,
}

/// Get a range of lines for virtualized rendering.
/// Returns lines from `start` index for `count` lines.
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

/// A text span with syntax highlighting style.
#[derive(Serialize, Clone)]
pub struct Span {
    /// The text content of this span
    pub text: String,
    /// CSS class name for styling (e.g., "heading", "code", "bold")
    pub style: String,
}

/// A line with syntax-highlighted spans.
#[derive(Serialize)]
pub struct HighlightedLine {
    /// 1-based line number
    pub num: usize,
    /// Syntax-highlighted spans for this line
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
            *code_lang = trimmed[3..].trim().to_lowercase();
            spans.push(Span {
                text: content.to_string(),
                style: "code-fence".to_string(),
            });
        }
        return spans;
    }

    // Inside code block - apply language-specific syntax highlighting
    if *in_code_block {
        return highlight_code(content, code_lang);
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

// ============================================================================
// Language-specific Syntax Highlighting
// ============================================================================

/// Main entry point for code highlighting - dispatches to language-specific highlighters
fn highlight_code(content: &str, lang: &str) -> Vec<Span> {
    match lang {
        "sql" => highlight_sql(content),
        "js" | "javascript" | "ts" | "typescript" | "jsx" | "tsx" => highlight_js(content),
        "php" => highlight_php(content),
        "python" | "py" => highlight_python(content),
        "rust" | "rs" => highlight_rust(content),
        "go" | "golang" => highlight_go(content),
        "bash" | "sh" | "shell" | "zsh" => highlight_bash(content),
        "json" => highlight_json(content),
        "html" | "xml" | "svg" => highlight_html(content),
        "css" | "scss" | "sass" => highlight_css(content),
        "yaml" | "yml" => highlight_yaml(content),
        "toml" => highlight_toml(content),
        "c" | "cpp" | "c++" | "h" | "hpp" => highlight_c(content),
        "java" | "kotlin" | "kt" => highlight_java(content),
        "ruby" | "rb" => highlight_ruby(content),
        "dockerfile" | "docker" => highlight_docker(content),
        _ => vec![Span {
            text: content.to_string(),
            style: "code-block".to_string(),
        }],
    }
}

/// Tokenize a line of code into spans based on patterns
fn tokenize_code(content: &str, keywords: &[&str], types: &[&str], builtins: &[&str], 
                 comment_start: &str, _string_chars: &[char], supports_single_quote: bool) -> Vec<Span> {
    let mut spans = Vec::new();
    let chars: Vec<char> = content.chars().collect();
    let mut i = 0;
    let mut current = String::new();

    // Check for single-line comment
    if !comment_start.is_empty() && content.trim_start().starts_with(comment_start) {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }

    while i < chars.len() {
        // String literals (double quotes)
        if chars[i] == '"' {
            if !current.is_empty() {
                spans.extend(classify_word(&current, keywords, types, builtins));
                current.clear();
            }
            let mut string_content = String::from("\"");
            i += 1;
            while i < chars.len() && chars[i] != '"' {
                if chars[i] == '\\' && i + 1 < chars.len() {
                    string_content.push(chars[i]);
                    i += 1;
                    string_content.push(chars[i]);
                } else {
                    string_content.push(chars[i]);
                }
                i += 1;
            }
            if i < chars.len() {
                string_content.push('"');
                i += 1;
            }
            spans.push(Span {
                text: string_content,
                style: "code-string".to_string(),
            });
            continue;
        }

        // String literals (single quotes)
        if supports_single_quote && chars[i] == '\'' {
            if !current.is_empty() {
                spans.extend(classify_word(&current, keywords, types, builtins));
                current.clear();
            }
            let mut string_content = String::from("'");
            i += 1;
            while i < chars.len() && chars[i] != '\'' {
                if chars[i] == '\\' && i + 1 < chars.len() {
                    string_content.push(chars[i]);
                    i += 1;
                    string_content.push(chars[i]);
                } else {
                    string_content.push(chars[i]);
                }
                i += 1;
            }
            if i < chars.len() {
                string_content.push('\'');
                i += 1;
            }
            spans.push(Span {
                text: string_content,
                style: "code-string".to_string(),
            });
            continue;
        }

        // Numbers
        if chars[i].is_ascii_digit() && (current.is_empty() || !current.chars().last().unwrap_or(' ').is_alphanumeric()) {
            if !current.is_empty() {
                spans.extend(classify_word(&current, keywords, types, builtins));
                current.clear();
            }
            let mut num = String::new();
            while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.' || chars[i] == 'x' || chars[i] == 'X' 
                   || (chars[i].is_ascii_hexdigit() && num.starts_with("0x"))) {
                num.push(chars[i]);
                i += 1;
            }
            spans.push(Span {
                text: num,
                style: "code-number".to_string(),
            });
            continue;
        }

        // Word boundaries
        if chars[i].is_alphanumeric() || chars[i] == '_' || chars[i] == '$' {
            current.push(chars[i]);
        } else {
            if !current.is_empty() {
                spans.extend(classify_word(&current, keywords, types, builtins));
                current.clear();
            }
            // Operators and punctuation
            let style = match chars[i] {
                '(' | ')' | '[' | ']' | '{' | '}' => "code-bracket",
                '=' | '+' | '-' | '*' | '/' | '%' | '<' | '>' | '!' | '&' | '|' | '^' | '~' => "code-operator",
                ';' | ',' | '.' | ':' => "code-punctuation",
                _ => "code-block",
            };
            spans.push(Span {
                text: chars[i].to_string(),
                style: style.to_string(),
            });
        }
        i += 1;
    }

    if !current.is_empty() {
        spans.extend(classify_word(&current, keywords, types, builtins));
    }

    // If no spans, return empty code-block
    if spans.is_empty() {
        spans.push(Span {
            text: content.to_string(),
            style: "code-block".to_string(),
        });
    }

    spans
}

/// Classify a word as keyword, type, builtin, or regular code
fn classify_word(word: &str, keywords: &[&str], types: &[&str], builtins: &[&str]) -> Vec<Span> {
    let style = if keywords.iter().any(|k| k.eq_ignore_ascii_case(word)) {
        "code-keyword"
    } else if types.iter().any(|t| t.eq_ignore_ascii_case(word)) {
        "code-type"
    } else if builtins.iter().any(|b| b.eq_ignore_ascii_case(word)) {
        "code-builtin"
    } else {
        "code-block"
    };
    
    vec![Span {
        text: word.to_string(),
        style: style.to_string(),
    }]
}

// SQL Highlighting
fn highlight_sql(content: &str) -> Vec<Span> {
    let keywords = [
        "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL", "LIKE",
        "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "JOIN", "LEFT", "RIGHT",
        "INNER", "OUTER", "ON", "AS", "DISTINCT", "ALL", "UNION", "INTERSECT", "EXCEPT",
        "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "ALTER", "DROP",
        "TABLE", "INDEX", "VIEW", "DATABASE", "SCHEMA", "IF", "EXISTS", "PRIMARY", "KEY",
        "FOREIGN", "REFERENCES", "CONSTRAINT", "DEFAULT", "AUTO_INCREMENT", "UNIQUE",
        "CHECK", "CASCADE", "RESTRICT", "TRIGGER", "PROCEDURE", "FUNCTION", "RETURN",
        "BEGIN", "END", "COMMIT", "ROLLBACK", "TRANSACTION", "CASE", "WHEN", "THEN", "ELSE",
        "ASC", "DESC", "NULLS", "FIRST", "LAST", "BETWEEN", "WITH", "RECURSIVE", "OVER",
        "PARTITION", "WINDOW", "ROWS", "RANGE", "UNBOUNDED", "PRECEDING", "FOLLOWING", "CURRENT",
    ];
    let types = [
        "INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT", "FLOAT", "DOUBLE", "DECIMAL",
        "NUMERIC", "REAL", "VARCHAR", "CHAR", "TEXT", "BLOB", "BOOLEAN", "BOOL", "DATE",
        "TIME", "DATETIME", "TIMESTAMP", "YEAR", "JSON", "UUID", "SERIAL", "MONEY",
    ];
    let builtins = [
        "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "CAST", "CONVERT",
        "CONCAT", "SUBSTRING", "TRIM", "UPPER", "LOWER", "LENGTH", "REPLACE", "NOW",
        "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP", "EXTRACT", "DATE_FORMAT",
        "DATEDIFF", "DATEADD", "YEAR", "MONTH", "DAY", "HOUR", "MINUTE", "SECOND",
        "ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE", "LAG", "LEAD", "FIRST_VALUE",
        "LAST_VALUE", "ROUND", "FLOOR", "CEIL", "ABS", "MOD", "POWER", "SQRT",
        "QUARTER",
    ];
    tokenize_code(content, &keywords, &types, &builtins, "--", &['"', '\''], true)
}

// JavaScript/TypeScript Highlighting
fn highlight_js(content: &str) -> Vec<Span> {
    // Check for // comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("//") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    let keywords = [
        "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
        "switch", "case", "break", "continue", "default", "try", "catch", "finally",
        "throw", "new", "delete", "typeof", "instanceof", "in", "of", "class", "extends",
        "constructor", "super", "this", "static", "get", "set", "async", "await", "yield",
        "import", "export", "from", "as", "default", "null", "undefined", "true", "false",
        "void", "with", "debugger", "enum", "implements", "interface", "package", "private",
        "protected", "public", "abstract", "declare", "type", "namespace", "module", "readonly",
    ];
    let types = [
        "string", "number", "boolean", "object", "symbol", "bigint", "any", "unknown",
        "never", "void", "Array", "Object", "String", "Number", "Boolean", "Function",
        "Promise", "Map", "Set", "WeakMap", "WeakSet", "Date", "RegExp", "Error",
    ];
    let builtins = [
        "console", "window", "document", "JSON", "Math", "parseInt", "parseFloat",
        "isNaN", "isFinite", "encodeURI", "decodeURI", "setTimeout", "setInterval",
        "clearTimeout", "clearInterval", "fetch", "alert", "confirm", "prompt",
        "require", "module", "exports", "process", "Buffer", "global", "__dirname", "__filename",
    ];
    tokenize_code(content, &keywords, &types, &builtins, "//", &['"', '\'', '`'], true)
}

// PHP Highlighting
fn highlight_php(content: &str) -> Vec<Span> {
    // Check for // or # comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("//") || trimmed.starts_with("#") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    let keywords = [
        "if", "else", "elseif", "endif", "while", "endwhile", "for", "endfor", "foreach",
        "endforeach", "switch", "case", "break", "continue", "default", "return", "function",
        "class", "extends", "implements", "interface", "trait", "use", "namespace", "new",
        "public", "private", "protected", "static", "final", "abstract", "const", "var",
        "global", "try", "catch", "finally", "throw", "instanceof", "clone", "echo", "print",
        "include", "require", "include_once", "require_once", "true", "false", "null",
        "and", "or", "xor", "as", "match", "fn", "readonly", "enum",
    ];
    let types = [
        "int", "float", "string", "bool", "array", "object", "callable", "iterable",
        "void", "mixed", "never", "self", "parent", "static",
    ];
    let builtins = [
        "array", "isset", "unset", "empty", "die", "exit", "list", "eval", "count",
        "strlen", "strpos", "substr", "str_replace", "explode", "implode", "trim",
        "strtolower", "strtoupper", "array_map", "array_filter", "array_merge",
        "json_encode", "json_decode", "var_dump", "print_r", "sprintf", "preg_match",
        "file_get_contents", "file_put_contents", "date", "time", "strtotime",
    ];
    tokenize_code(content, &keywords, &types, &builtins, "//", &['"', '\''], true)
}

// Python Highlighting
fn highlight_python(content: &str) -> Vec<Span> {
    // Check for # comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("#") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    let keywords = [
        "def", "class", "if", "elif", "else", "for", "while", "try", "except", "finally",
        "with", "as", "import", "from", "return", "yield", "raise", "pass", "break",
        "continue", "lambda", "and", "or", "not", "in", "is", "True", "False", "None",
        "global", "nonlocal", "assert", "del", "async", "await", "match", "case",
    ];
    let types = [
        "int", "float", "str", "bool", "list", "dict", "tuple", "set", "frozenset",
        "bytes", "bytearray", "complex", "type", "object", "None",
    ];
    let builtins = [
        "print", "len", "range", "enumerate", "zip", "map", "filter", "sorted", "reversed",
        "open", "input", "type", "isinstance", "hasattr", "getattr", "setattr", "dir",
        "vars", "id", "repr", "str", "int", "float", "list", "dict", "set", "tuple",
        "sum", "min", "max", "abs", "round", "pow", "divmod", "all", "any", "iter", "next",
        "super", "classmethod", "staticmethod", "property", "self", "cls",
    ];
    tokenize_code(content, &keywords, &types, &builtins, "#", &['"', '\''], true)
}

// Rust Highlighting
fn highlight_rust(content: &str) -> Vec<Span> {
    // Check for // comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("//") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    let keywords = [
        "fn", "let", "mut", "const", "static", "if", "else", "match", "for", "while",
        "loop", "break", "continue", "return", "struct", "enum", "impl", "trait", "type",
        "use", "mod", "pub", "crate", "self", "super", "where", "as", "in", "ref", "move",
        "async", "await", "dyn", "unsafe", "extern", "true", "false",
    ];
    let types = [
        "i8", "i16", "i32", "i64", "i128", "isize", "u8", "u16", "u32", "u64", "u128",
        "usize", "f32", "f64", "bool", "char", "str", "String", "Vec", "Box", "Rc", "Arc",
        "Option", "Result", "Some", "None", "Ok", "Err", "Self",
    ];
    let builtins = [
        "println", "print", "format", "panic", "assert", "assert_eq", "assert_ne",
        "dbg", "todo", "unimplemented", "unreachable", "vec", "include_str", "include_bytes",
        "env", "cfg", "derive", "Default", "Clone", "Copy", "Debug", "Display",
    ];
    tokenize_code(content, &keywords, &types, &builtins, "//", &['"'], false)
}

// Go Highlighting
fn highlight_go(content: &str) -> Vec<Span> {
    // Check for // comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("//") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    let keywords = [
        "func", "var", "const", "type", "struct", "interface", "map", "chan", "if", "else",
        "for", "range", "switch", "case", "default", "break", "continue", "return", "go",
        "defer", "select", "fallthrough", "goto", "package", "import", "true", "false", "nil",
    ];
    let types = [
        "int", "int8", "int16", "int32", "int64", "uint", "uint8", "uint16", "uint32",
        "uint64", "uintptr", "float32", "float64", "complex64", "complex128", "byte",
        "rune", "string", "bool", "error", "any",
    ];
    let builtins = [
        "make", "new", "len", "cap", "append", "copy", "delete", "close", "panic",
        "recover", "print", "println", "complex", "real", "imag", "fmt", "log", "os",
        "io", "strings", "strconv", "time", "context", "sync", "errors",
    ];
    tokenize_code(content, &keywords, &types, &builtins, "//", &['"', '\'', '`'], true)
}

// Bash/Shell Highlighting
fn highlight_bash(content: &str) -> Vec<Span> {
    // Check for # comments (but not #!)
    let trimmed = content.trim_start();
    if trimmed.starts_with("#") && !trimmed.starts_with("#!") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    let keywords = [
        "if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac",
        "in", "function", "return", "local", "export", "source", "alias", "unalias",
        "set", "unset", "shift", "exit", "break", "continue", "true", "false",
    ];
    let types: [&str; 0] = [];
    let builtins = [
        "echo", "printf", "read", "cd", "pwd", "ls", "cat", "grep", "sed", "awk", "cut",
        "sort", "uniq", "wc", "head", "tail", "find", "xargs", "mkdir", "rm", "cp", "mv",
        "chmod", "chown", "test", "expr", "eval", "exec", "trap", "wait", "kill",
    ];
    tokenize_code(content, &keywords, &types, &builtins, "#", &['"', '\''], true)
}

// JSON Highlighting
fn highlight_json(content: &str) -> Vec<Span> {
    let mut spans = Vec::new();
    let chars: Vec<char> = content.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        // Strings (keys and values)
        if chars[i] == '"' {
            let mut string_content = String::from("\"");
            i += 1;
            while i < chars.len() && chars[i] != '"' {
                if chars[i] == '\\' && i + 1 < chars.len() {
                    string_content.push(chars[i]);
                    i += 1;
                    string_content.push(chars[i]);
                } else {
                    string_content.push(chars[i]);
                }
                i += 1;
            }
            if i < chars.len() {
                string_content.push('"');
                i += 1;
            }
            // Check if it's a key (followed by :)
            let is_key = chars.iter().skip(i).take_while(|c| c.is_whitespace()).count() 
                + i < chars.len() && chars.get(i + chars.iter().skip(i).take_while(|c| c.is_whitespace()).count()) == Some(&':');
            spans.push(Span {
                text: string_content,
                style: if is_key { "code-property".to_string() } else { "code-string".to_string() },
            });
            continue;
        }

        // Numbers
        if chars[i].is_ascii_digit() || (chars[i] == '-' && i + 1 < chars.len() && chars[i + 1].is_ascii_digit()) {
            let mut num = String::new();
            if chars[i] == '-' {
                num.push(chars[i]);
                i += 1;
            }
            while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.' || chars[i] == 'e' || chars[i] == 'E' || chars[i] == '+' || chars[i] == '-') {
                num.push(chars[i]);
                i += 1;
            }
            spans.push(Span {
                text: num,
                style: "code-number".to_string(),
            });
            continue;
        }

        // Keywords: true, false, null
        if chars[i].is_alphabetic() {
            let mut word = String::new();
            while i < chars.len() && chars[i].is_alphabetic() {
                word.push(chars[i]);
                i += 1;
            }
            let style = match word.as_str() {
                "true" | "false" => "code-keyword",
                "null" => "code-builtin",
                _ => "code-block",
            };
            spans.push(Span {
                text: word,
                style: style.to_string(),
            });
            continue;
        }

        // Brackets and punctuation
        let style = match chars[i] {
            '{' | '}' | '[' | ']' => "code-bracket",
            ':' | ',' => "code-punctuation",
            _ => "code-block",
        };
        spans.push(Span {
            text: chars[i].to_string(),
            style: style.to_string(),
        });
        i += 1;
    }

    if spans.is_empty() {
        spans.push(Span {
            text: content.to_string(),
            style: "code-block".to_string(),
        });
    }

    spans
}

// HTML/XML Highlighting
fn highlight_html(content: &str) -> Vec<Span> {
    let mut spans = Vec::new();
    let chars: Vec<char> = content.chars().collect();
    let mut i = 0;

    // Check for HTML comment
    if content.trim_start().starts_with("<!--") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }

    while i < chars.len() {
        // Tags
        if chars[i] == '<' {
            let mut tag = String::from("<");
            i += 1;
            
            // Closing tag slash or !DOCTYPE
            if i < chars.len() && (chars[i] == '/' || chars[i] == '!') {
                tag.push(chars[i]);
                i += 1;
            }
            
            // Tag name
            let mut tag_name = String::new();
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '-' || chars[i] == '_') {
                tag_name.push(chars[i]);
                i += 1;
            }
            
            if !tag_name.is_empty() {
                spans.push(Span {
                    text: tag,
                    style: "code-bracket".to_string(),
                });
                spans.push(Span {
                    text: tag_name,
                    style: "code-keyword".to_string(),
                });
            } else {
                spans.push(Span {
                    text: tag,
                    style: "code-bracket".to_string(),
                });
            }
            
            // Attributes until >
            while i < chars.len() && chars[i] != '>' {
                if chars[i] == '"' {
                    let mut attr_val = String::from("\"");
                    i += 1;
                    while i < chars.len() && chars[i] != '"' {
                        attr_val.push(chars[i]);
                        i += 1;
                    }
                    if i < chars.len() {
                        attr_val.push('"');
                        i += 1;
                    }
                    spans.push(Span {
                        text: attr_val,
                        style: "code-string".to_string(),
                    });
                } else if chars[i].is_alphabetic() || chars[i] == '-' || chars[i] == '_' {
                    let mut attr_name = String::new();
                    while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '-' || chars[i] == '_') {
                        attr_name.push(chars[i]);
                        i += 1;
                    }
                    spans.push(Span {
                        text: attr_name,
                        style: "code-property".to_string(),
                    });
                } else {
                    spans.push(Span {
                        text: chars[i].to_string(),
                        style: "code-block".to_string(),
                    });
                    i += 1;
                }
            }
            
            // Closing >
            if i < chars.len() && chars[i] == '>' {
                spans.push(Span {
                    text: ">".to_string(),
                    style: "code-bracket".to_string(),
                });
                i += 1;
            }
            continue;
        }

        // Regular text content
        let mut text = String::new();
        while i < chars.len() && chars[i] != '<' {
            text.push(chars[i]);
            i += 1;
        }
        if !text.is_empty() {
            spans.push(Span {
                text,
                style: "code-block".to_string(),
            });
        }
    }

    if spans.is_empty() {
        spans.push(Span {
            text: content.to_string(),
            style: "code-block".to_string(),
        });
    }

    spans
}

// CSS Highlighting
fn highlight_css(content: &str) -> Vec<Span> {
    // Check for comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("/*") || trimmed.starts_with("//") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    let mut spans = Vec::new();
    let chars: Vec<char> = content.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        // Property values with units or colors
        if chars[i] == '#' {
            let mut color = String::from("#");
            i += 1;
            while i < chars.len() && chars[i].is_ascii_hexdigit() {
                color.push(chars[i]);
                i += 1;
            }
            spans.push(Span {
                text: color,
                style: "code-number".to_string(),
            });
            continue;
        }

        // Strings
        if chars[i] == '"' || chars[i] == '\'' {
            let quote = chars[i];
            let mut string_content = String::from(chars[i]);
            i += 1;
            while i < chars.len() && chars[i] != quote {
                string_content.push(chars[i]);
                i += 1;
            }
            if i < chars.len() {
                string_content.push(quote);
                i += 1;
            }
            spans.push(Span {
                text: string_content,
                style: "code-string".to_string(),
            });
            continue;
        }

        // Numbers with units
        if chars[i].is_ascii_digit() || (chars[i] == '.' && i + 1 < chars.len() && chars[i + 1].is_ascii_digit()) {
            let mut num = String::new();
            while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.') {
                num.push(chars[i]);
                i += 1;
            }
            // Include units like px, em, rem, %, etc.
            while i < chars.len() && chars[i].is_alphabetic() {
                num.push(chars[i]);
                i += 1;
            }
            spans.push(Span {
                text: num,
                style: "code-number".to_string(),
            });
            continue;
        }

        // Words (properties, values, selectors)
        if chars[i].is_alphabetic() || chars[i] == '-' || chars[i] == '_' || chars[i] == '@' || chars[i] == '.' {
            let mut word = String::new();
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '-' || chars[i] == '_') {
                word.push(chars[i]);
                i += 1;
            }
            // Check if followed by colon (property) or is a pseudo-class/at-rule
            let style = if word.starts_with('@') {
                "code-keyword"
            } else if i < chars.len() && chars[i] == ':' {
                "code-property"
            } else if word.starts_with('.') {
                "code-type"
            } else {
                "code-block"
            };
            spans.push(Span {
                text: word,
                style: style.to_string(),
            });
            continue;
        }

        // Brackets and punctuation
        let style = match chars[i] {
            '{' | '}' | '(' | ')' | '[' | ']' => "code-bracket",
            ':' | ';' | ',' => "code-punctuation",
            _ => "code-block",
        };
        spans.push(Span {
            text: chars[i].to_string(),
            style: style.to_string(),
        });
        i += 1;
    }

    if spans.is_empty() {
        spans.push(Span {
            text: content.to_string(),
            style: "code-block".to_string(),
        });
    }

    spans
}

// YAML Highlighting
fn highlight_yaml(content: &str) -> Vec<Span> {
    // Check for comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("#") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    let mut spans = Vec::new();
    let chars: Vec<char> = content.chars().collect();
    let mut i = 0;
    
    // Leading whitespace
    while i < chars.len() && chars[i].is_whitespace() {
        spans.push(Span {
            text: chars[i].to_string(),
            style: "code-block".to_string(),
        });
        i += 1;
    }
    
    // List marker
    if i < chars.len() && chars[i] == '-' && (i + 1 >= chars.len() || chars[i + 1].is_whitespace()) {
        spans.push(Span {
            text: "-".to_string(),
            style: "code-keyword".to_string(),
        });
        i += 1;
        while i < chars.len() && chars[i].is_whitespace() {
            spans.push(Span {
                text: chars[i].to_string(),
                style: "code-block".to_string(),
            });
            i += 1;
        }
    }
    
    // Key: value
    let mut key = String::new();
    while i < chars.len() && chars[i] != ':' && chars[i] != '#' {
        key.push(chars[i]);
        i += 1;
    }
    
    if i < chars.len() && chars[i] == ':' {
        if !key.is_empty() {
            spans.push(Span {
                text: key,
                style: "code-property".to_string(),
            });
        }
        spans.push(Span {
            text: ":".to_string(),
            style: "code-punctuation".to_string(),
        });
        i += 1;
        
        // Value
        let remaining: String = chars[i..].iter().collect();
        let remaining_trimmed = remaining.trim();
        
        if remaining_trimmed.starts_with('"') || remaining_trimmed.starts_with('\'') {
            // String value - highlight as string
            spans.push(Span {
                text: remaining,
                style: "code-string".to_string(),
            });
        } else if remaining_trimmed == "true" || remaining_trimmed == "false" {
            spans.push(Span {
                text: remaining,
                style: "code-keyword".to_string(),
            });
        } else if remaining_trimmed == "null" || remaining_trimmed == "~" {
            spans.push(Span {
                text: remaining,
                style: "code-builtin".to_string(),
            });
        } else if remaining_trimmed.parse::<f64>().is_ok() {
            spans.push(Span {
                text: remaining,
                style: "code-number".to_string(),
            });
        } else {
            spans.push(Span {
                text: remaining,
                style: "code-block".to_string(),
            });
        }
    } else {
        // No colon found, could be a comment or plain text
        if !key.is_empty() {
            spans.push(Span {
                text: key,
                style: "code-block".to_string(),
            });
        }
        if i < chars.len() {
            spans.push(Span {
                text: chars[i..].iter().collect(),
                style: "code-comment".to_string(),
            });
        }
    }

    if spans.is_empty() {
        spans.push(Span {
            text: content.to_string(),
            style: "code-block".to_string(),
        });
    }

    spans
}

// TOML Highlighting
fn highlight_toml(content: &str) -> Vec<Span> {
    // Check for comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("#") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    // Section headers [section]
    if trimmed.starts_with("[") {
        return vec![Span {
            text: content.to_string(),
            style: "code-keyword".to_string(),
        }];
    }
    
    let keywords: [&str; 0] = [];
    let types = ["true", "false"];
    let builtins: [&str; 0] = [];
    tokenize_code(content, &keywords, &types, &builtins, "#", &['"', '\''], true)
}

// C/C++ Highlighting
fn highlight_c(content: &str) -> Vec<Span> {
    // Check for // comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("//") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    // Preprocessor directives
    if trimmed.starts_with("#") {
        return vec![Span {
            text: content.to_string(),
            style: "code-builtin".to_string(),
        }];
    }
    
    let keywords = [
        "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue",
        "return", "goto", "struct", "union", "enum", "typedef", "sizeof", "static", "extern",
        "const", "volatile", "register", "auto", "inline", "restrict", "class", "public",
        "private", "protected", "virtual", "override", "final", "new", "delete", "try",
        "catch", "throw", "template", "typename", "namespace", "using", "true", "false",
        "nullptr", "this", "operator", "friend", "explicit", "mutable", "constexpr",
    ];
    let types = [
        "void", "int", "char", "short", "long", "float", "double", "signed", "unsigned",
        "bool", "size_t", "ssize_t", "ptrdiff_t", "int8_t", "int16_t", "int32_t", "int64_t",
        "uint8_t", "uint16_t", "uint32_t", "uint64_t", "string", "vector", "map", "set",
        "array", "list", "deque", "queue", "stack", "pair", "tuple", "unique_ptr", "shared_ptr",
    ];
    let builtins = [
        "printf", "scanf", "malloc", "free", "realloc", "calloc", "memcpy", "memset",
        "strlen", "strcpy", "strcmp", "strcat", "fopen", "fclose", "fread", "fwrite",
        "fprintf", "fscanf", "cout", "cin", "endl", "std", "NULL",
    ];
    tokenize_code(content, &keywords, &types, &builtins, "//", &['"'], false)
}

// Java/Kotlin Highlighting
fn highlight_java(content: &str) -> Vec<Span> {
    // Check for // comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("//") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    let keywords = [
        "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue",
        "return", "class", "interface", "extends", "implements", "new", "this", "super",
        "public", "private", "protected", "static", "final", "abstract", "native", "synchronized",
        "volatile", "transient", "try", "catch", "finally", "throw", "throws", "import", "package",
        "instanceof", "assert", "enum", "true", "false", "null", "void", "var", "val", "fun",
        "when", "object", "companion", "data", "sealed", "lateinit", "by", "lazy", "suspend",
    ];
    let types = [
        "int", "long", "short", "byte", "float", "double", "char", "boolean", "Integer",
        "Long", "Short", "Byte", "Float", "Double", "Character", "Boolean", "String",
        "Object", "Class", "List", "ArrayList", "Map", "HashMap", "Set", "HashSet",
        "Array", "Collection", "Iterable", "Iterator", "Exception", "Throwable", "Any", "Unit",
    ];
    let builtins = [
        "System", "out", "println", "print", "printf", "String", "Math", "Arrays", "Collections",
        "Objects", "Optional", "Stream", "Collectors", "Thread", "Runnable", "Callable",
        "listOf", "mapOf", "setOf", "arrayOf", "mutableListOf", "mutableMapOf",
    ];
    tokenize_code(content, &keywords, &types, &builtins, "//", &['"'], false)
}

// Ruby Highlighting
fn highlight_ruby(content: &str) -> Vec<Span> {
    // Check for # comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("#") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    let keywords = [
        "def", "end", "class", "module", "if", "elsif", "else", "unless", "case", "when",
        "while", "until", "for", "do", "begin", "rescue", "ensure", "raise", "return",
        "yield", "break", "next", "redo", "retry", "and", "or", "not", "in", "then",
        "self", "super", "true", "false", "nil", "alias", "defined?", "require", "require_relative",
        "include", "extend", "prepend", "attr_reader", "attr_writer", "attr_accessor",
        "public", "private", "protected", "lambda", "proc",
    ];
    let types = [
        "String", "Integer", "Float", "Array", "Hash", "Symbol", "Proc", "Lambda",
        "Class", "Module", "Object", "NilClass", "TrueClass", "FalseClass", "Numeric",
        "Range", "Regexp", "Time", "Date", "DateTime", "File", "IO", "Exception",
    ];
    let builtins = [
        "puts", "print", "p", "gets", "chomp", "to_s", "to_i", "to_f", "to_a", "to_h",
        "length", "size", "count", "empty?", "nil?", "each", "map", "select", "reject",
        "reduce", "inject", "find", "any?", "all?", "none?", "sort", "reverse", "join",
        "split", "strip", "upcase", "downcase", "capitalize", "gsub", "sub", "match",
    ];
    tokenize_code(content, &keywords, &types, &builtins, "#", &['"', '\''], true)
}

// Dockerfile Highlighting
fn highlight_docker(content: &str) -> Vec<Span> {
    // Check for # comments
    let trimmed = content.trim_start();
    if trimmed.starts_with("#") {
        return vec![Span {
            text: content.to_string(),
            style: "code-comment".to_string(),
        }];
    }
    
    let keywords = [
        "FROM", "AS", "RUN", "CMD", "LABEL", "MAINTAINER", "EXPOSE", "ENV", "ADD", "COPY",
        "ENTRYPOINT", "VOLUME", "USER", "WORKDIR", "ARG", "ONBUILD", "STOPSIGNAL",
        "HEALTHCHECK", "SHELL",
    ];
    let types: [&str; 0] = [];
    let builtins = [
        "apt-get", "yum", "apk", "pip", "npm", "yarn", "go", "cargo", "make", "cmake",
        "install", "update", "upgrade", "clean", "rm", "mkdir", "chmod", "chown",
    ];
    tokenize_code(content, &keywords, &types, &builtins, "#", &['"', '\''], true)
}

/// Get syntax-highlighted lines for virtualized rendering.
/// Tracks code block state across the document for accurate highlighting.
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
                    code_lang = trimmed[3..].trim().to_lowercase();
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

/// Reset code block tracking state. Call when loading new content.
#[wasm_bindgen]
pub fn reset_highlighting_state() {
    IN_CODE_BLOCK.with(|f| *f.borrow_mut() = false);
    CODE_BLOCK_LANG.with(|f| *f.borrow_mut() = String::new());
}

// ============================================================================
// Phase 6: Cursor & Selection
// ============================================================================

/// Set cursor position (clamped to buffer length).
#[wasm_bindgen]
pub fn set_cursor(pos: usize) {
    CURSOR.with(|c| {
        BUFFER.with(|b| {
            let max_pos = b.borrow().len_chars();
            *c.borrow_mut() = pos.min(max_pos);
        });
    });
}

/// Get current cursor position as character offset.
#[wasm_bindgen]
pub fn get_cursor() -> usize {
    CURSOR.with(|c| *c.borrow())
}

/// Cursor position with line, column, and offset.
#[derive(Serialize)]
pub struct CursorPosition {
    /// 0-based line number
    pub line: usize,
    /// 0-based column number
    pub col: usize,
    /// Character offset from start of buffer
    pub offset: usize,
}

/// Get cursor position as line, column, and offset.
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

/// Set selection range (start and end are normalized and clamped).
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

/// Clear the current selection.
#[wasm_bindgen]
pub fn clear_selection() {
    SELECTION.with(|s| {
        *s.borrow_mut() = None;
    });
}

/// Get current selection as (start, end) tuple or null.
#[wasm_bindgen]
pub fn get_selection() -> JsValue {
    SELECTION.with(|s| serde_wasm_bindgen::to_value(&*s.borrow()).unwrap_or(JsValue::NULL))
}

/// Get the text content of the current selection, if any.
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

/// Convert line and column to character offset.
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

/// Save current state to undo stack. Clears redo stack.
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

/// Undo last change. Returns true if undo was performed.
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

/// Redo last undone change. Returns true if redo was performed.
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

/// Check if undo is available.
#[wasm_bindgen]
pub fn can_undo() -> bool {
    UNDO_STACK.with(|undo| !undo.borrow().is_empty())
}

/// Check if redo is available.
#[wasm_bindgen]
pub fn can_redo() -> bool {
    REDO_STACK.with(|redo| !redo.borrow().is_empty())
}

/// Clear both undo and redo stacks.
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
