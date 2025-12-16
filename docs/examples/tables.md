# Tables

MD supports GitHub-flavored markdown tables with alignment options.

## Basic Table

| Name | Age | City |
|------|-----|------|
| Alice | 28 | New York |
| Bob | 34 | San Francisco |
| Carol | 42 | Chicago |

## Column Alignment

| Left | Center | Right |
|:-----|:------:|------:|
| L1 | C1 | R1 |
| L2 | C2 | R2 |
| L3 | C3 | R3 |

## Feature Comparison

| Feature | Free | Pro | Enterprise |
|---------|:----:|:---:|:----------:|
| Users | 5 | 50 | Unlimited |
| Storage | 1 GB | 100 GB | 1 TB |
| Support | Community | Email | 24/7 Phone |
| API Access | ❌ | ✅ | ✅ |
| SSO | ❌ | ❌ | ✅ |
| Custom Domain | ❌ | ✅ | ✅ |
| Analytics | Basic | Advanced | Enterprise |
| Price | $0 | $29/mo | Contact us |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save file |
| `Ctrl+W` | Close file |
| `Ctrl+N` | New draft |
| `Ctrl+Space` | Toggle edit mode |
| `Ctrl+F` | Search |
| `Ctrl+G` | Table of contents |
| `Ctrl+P` | Print / PDF |
| `Ctrl+T` | Toggle theme |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+H` | Help |
| `Ctrl++/-` | Font size |

## HTTP Status Codes

| Code | Status | Description |
|-----:|--------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created |
| 204 | No Content | Success, no body |
| 400 | Bad Request | Invalid syntax |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | Invalid upstream response |
| 503 | Service Unavailable | Server overloaded |

## Data Types

| Type | Size | Range | Example |
|------|-----:|-------|---------|
| `i8` | 1 byte | -128 to 127 | `let x: i8 = -5;` |
| `u8` | 1 byte | 0 to 255 | `let x: u8 = 200;` |
| `i32` | 4 bytes | ±2.1 billion | `let x: i32 = 42;` |
| `i64` | 8 bytes | ±9.2 quintillion | `let x: i64 = 1_000_000;` |
| `f32` | 4 bytes | 6-7 decimal digits | `let x: f32 = 3.14;` |
| `f64` | 8 bytes | 15-16 decimal digits | `let x: f64 = 2.718281828;` |
| `bool` | 1 byte | true/false | `let x: bool = true;` |
| `char` | 4 bytes | Unicode scalar | `let x: char = '🦀';` |

## Complex Content in Cells

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `GET` | `/users` | - | `[{id, name, email}, ...]` |
| `GET` | `/users/:id` | - | `{id, name, email}` |
| `POST` | `/users` | `{name, email}` | `{id, name, email}` |
| `PUT` | `/users/:id` | `{name, email}` | `{id, name, email}` |
| `DELETE` | `/users/:id` | - | `204 No Content` |

## Long Content

| Package | Version | Description |
|---------|---------|-------------|
| `@tauri-apps/api` | 2.0.0 | Core Tauri API for JavaScript/TypeScript |
| `solid-js` | 1.9.3 | Reactive UI library with fine-grained reactivity |
| `shiki` | 3.15.0 | Syntax highlighter using TextMate grammars |
| `markdown-it` | 14.1.0 | Markdown parser with plugin support |
| `mermaid` | 11.12.2 | Diagram and flowchart rendering |
