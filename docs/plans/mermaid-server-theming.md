# Mermaid Server-Side Theming

**Goal:** Unify mermaid rendering between desktop app and extension API.

**Problem:** App uses custom `themeVariables` + `themeCSS`, API just passes `'dark'` or `'light'` string.

---

## Phase 1: Fail-Fast Validation

Before any implementation, test if custom theming works in headless Chrome.

### Test 1: Raw chromedp script

Create standalone Go script that:
1. Spawns headless Chrome
2. Loads mermaid from CDN
3. Calls `mermaid.initialize()` with custom `themeVariables`
4. Renders a test diagram
5. Outputs SVG to file

**Test diagram:**
```
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
```

**Custom theme (use obviously wrong colors to verify):**
```javascript
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',  // 'base' theme = no defaults, uses themeVariables
  themeVariables: {
    primaryColor: '#ff0000',      // bright red nodes
    primaryBorderColor: '#00ff00', // green borders
    lineColor: '#0000ff',          // blue lines
  }
});
```

**Success criteria:** SVG contains red fills, green strokes, blue lines.

### Test 2: themeCSS injection

Same as Test 1, but add `themeCSS`:
```javascript
mermaid.initialize({
  theme: 'base',
  themeVariables: { ... },
  themeCSS: `
    .node rect { rx: 10; ry: 10; }
    .cluster rect { stroke-dasharray: 5,5; }
  `
});
```

**Success criteria:** SVG shows rounded corners and dashed cluster borders.

---

## Phase 2: Implementation (if Phase 1 passes)

### API Changes

1. **New endpoint or parameter:**
   - Option A: `/render/mermaid/{theme}/{hash}` where theme = `dark|light|custom`
   - Option B: POST body with theme config (more flexible)

2. **Theme config structure:**
```go
type MermaidTheme struct {
    Name           string            `json:"name"`  // dark, light, custom
    ThemeVariables map[string]string `json:"themeVariables,omitempty"`
    ThemeCSS       string            `json:"themeCSS,omitempty"`
}
```

3. **Predefined themes:**
   - Store dark/light configs as Go constants (matching app's `DEFAULT_DARK_COLORS` / `DEFAULT_LIGHT_COLORS`)
   - Extension sends just `dark` or `light`, API expands to full config

### Shared Theme Definition

Extract theme colors to `packages/shared/`:
```
packages/shared/
  themes/
    mermaid.ts    # Theme color definitions
    mermaid.json  # Same data for Go to embed
```

Go embeds JSON, TypeScript imports directly.

### Cache Key Changes

Current: `{theme}:{hash}` where theme = `dark|light`
New: `{themeHash}:{codeHash}` where themeHash = hash of full theme config

---

## Phase 3: Testing

1. Render same diagram with app and API, compare SVG output
2. Visual diff test (screenshot comparison)
3. Test all diagram types: flowchart, sequence, ER, state, class

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/api/cmd/theme-test/main.go` | Phase 1 test script |
| `packages/api/internal/renderer/mermaid.go` | Add theme config support |
| `packages/shared/themes/mermaid.json` | Shared theme definitions |
| `packages/extension/src/api.ts` | Pass theme config |

---

## Open Questions

1. **SVG size impact?** Custom CSS embedded in each SVG vs external stylesheet
2. **Cache invalidation?** Theme changes = new cache keys, old entries orphaned
3. **Extension storage?** Can extension persist custom theme colors?

---

## Next Step

Run Phase 1 Test 1. Create `packages/api/cmd/theme-test/main.go`.
