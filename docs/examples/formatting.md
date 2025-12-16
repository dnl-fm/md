# Text Formatting

MD supports standard Markdown formatting with GitHub-flavored extensions.

## Headings

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

## Text Styles

**Bold text** using double asterisks or __underscores__.

*Italic text* using single asterisks or _underscores_.

***Bold and italic*** combined.

~~Strikethrough~~ using double tildes.

`Inline code` using backticks.

## Links

[External link](https://github.com)

[Link with title](https://github.com "GitHub")

[Reference link][ref]

[ref]: https://github.com

Autolinked URL: https://github.com

Email: contact@example.com

## Lists

### Unordered Lists

- Item one
- Item two
  - Nested item A
  - Nested item B
    - Deep nested
- Item three

Alternative markers:

* Asterisk item
+ Plus item
- Minus item

### Ordered Lists

1. First item
2. Second item
   1. Nested first
   2. Nested second
3. Third item

### Task Lists

- [x] Completed task
- [x] Another done
- [ ] Pending task
- [ ] Future task

## Blockquotes

> This is a blockquote.
> It can span multiple lines.

> Nested quotes:
> > Level two
> > > Level three

> **Formatted** blockquote with `code` and [links](https://example.com).

## Code

Inline: Use `console.log()` for debugging.

Block with language:

```javascript
function greet(name) {
  return `Hello, ${name}!`;
}
```

Block without language:

```
Plain text code block
No syntax highlighting
```

Indented code block (4 spaces):

    function example() {
      return 42;
    }

## Horizontal Rules

Three or more hyphens:

---

Three or more asterisks:

***

Three or more underscores:

___

## Images

![Alt text](https://via.placeholder.com/150 "Optional title")

Reference style:

![Alt text][img]

[img]: https://via.placeholder.com/100

## HTML Elements

<details>
<summary>Click to expand</summary>

Hidden content revealed!

- Supports markdown inside
- **Bold** and *italic*

</details>

<kbd>Ctrl</kbd> + <kbd>C</kbd> to copy

Text with <mark>highlighted</mark> content.

<sup>superscript</sup> and <sub>subscript</sub>

## Escaping

Use backslash to escape special characters:

\*Not italic\*

\`Not code\`

\# Not a heading

## Footnotes

Here's a sentence with a footnote[^1].

And another one[^note].

[^1]: This is the first footnote.
[^note]: This is a named footnote.

## Definition Lists

Term 1
: Definition for term 1

Term 2
: Definition for term 2
: Alternative definition

## Abbreviations

The HTML specification is maintained by the W3C.

*[HTML]: Hyper Text Markup Language
*[W3C]: World Wide Web Consortium

## Math (if supported)

Inline math: $E = mc^2$

Block math:

$$
\frac{n!}{k!(n-k)!} = \binom{n}{k}
$$

## Emoji

GitHub-style emoji: :rocket: :star: :heart:

Unicode emoji: 🚀 ⭐ ❤️
