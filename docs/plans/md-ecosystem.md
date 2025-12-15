# MD Ecosystem Plan

> Expanding MD from desktop app to collaborative markdown platform

## Vision

Reduce friction for people working with markdown files. View, edit, and share markdown seamlessly across desktop and browser.

## Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        MD Ecosystem                              │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   MD App        │  MD Extension   │  MD Cloud                   │
│   (Tauri)       │  (Chrome)       │  (API + Web)                │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ • Local files   │ • Raw .md URLs  │ • Document storage          │
│ • Full editing  │ • Quick preview │ • Revision history          │
│ • Print/PDF     │ • Light editing │ • Shareable links           │
│ • Offline       │ • Open in MD    │ • Diff view                 │
│                 │ • Share to cloud│ • Collaboration             │
└─────────────────┴─────────────────┴─────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │   Shared    │
                    │   Package   │
                    ├─────────────┤
                    │ • CSS       │
                    │ • Types     │
                    │ • Utils     │
                    │ • Renderer  │
                    └─────────────┘
```

## Monorepo Structure

Convert current flat structure to workspace-based monorepo:

```
md/
├── packages/
│   ├── shared/                    # Shared code
│   │   ├── package.json
│   │   ├── styles/
│   │   │   ├── theme.css          # CSS variables, colors
│   │   │   ├── markdown.css       # Rendered markdown styles
│   │   │   └── print.css          # Print styles
│   │   ├── types/
│   │   │   └── index.ts           # Shared TypeScript types
│   │   └── utils/
│   │       └── index.ts           # Shared utilities
│   │
│   ├── app/                       # Tauri desktop app
│   │   ├── package.json
│   │   ├── src/                   # SolidJS frontend
│   │   ├── src-tauri/             # Rust backend
│   │   └── src-wasm/              # WASM module
│   │
│   └── extension/                 # Chrome extension
│       ├── package.json
│       ├── manifest.json
│       ├── src/
│       │   ├── content.ts         # Content script
│       │   ├── background.ts      # Service worker
│       │   └── popup/             # Settings popup
│       └── icons/
│
├── package.json                   # Workspace root
├── bun.lock
└── README.md
```

**Workspace config (root package.json):**
```json
{
  "name": "md",
  "private": true,
  "workspaces": ["packages/*"]
}
```

**Benefits:**
- Single `bun install` for all packages
- Import shared code: `import '@md/shared/styles/theme.css'`
- Consistent versions across packages
- Single CI pipeline

---

## Phases

### Phase 1: Extension MVP (View Only)

**Goal:** Chrome extension that renders raw .md URLs beautifully

**Scope:**
- Detect raw .md file URLs (Gitea, GitHub, GitLab, any text/plain .md)
- Replace page content with rendered markdown
- System theme (light/dark via prefers-color-scheme)
- Table of contents (Ctrl+G)
- Syntax highlighting (Shiki)
- Mermaid diagram support

**Out of scope (Phase 1):**
- Edit mode
- Sharing
- Open in MD app
- Custom settings

**Deliverables:**
- Working Chrome extension
- Installable via "Load unpacked"
- Shared styles extracted from app

---

### Phase 2: Extension Edit Mode

**Goal:** Allow editing with save options

**Scope:**
- Toggle edit mode (Ctrl+Space)
- Split view: editor | preview
- Live preview updates
- Save options (Ctrl+S):
  - Download as .md file
  - Copy to clipboard
- Ephemeral edits (no persistence)

**Deliverables:**
- Edit mode UI
- Download/copy functionality

---

### Phase 3: Deep Link Integration

**Goal:** Connect extension to MD desktop app

**Scope:**
- MD app registers `md://` protocol handler
- Extension shows "Open in MD" banner
- Click opens file in MD app
- MD app fetches remote URL content

**MD App Changes:**
- Add `@tauri-apps/plugin-deep-link`
- Register protocol in tauri.conf.json
- New command: `open_remote_url`
- Handle `md://open?url=<encoded-url>`

**Deliverables:**
- Deep link support in MD app
- "Open in MD" button in extension

---

### Phase 4: MD Cloud (Backend)

**Goal:** Persistent document storage with sharing

**Tech Stack:**
- Go backend
- PostgreSQL database
- Hosted at md.lanu.team

**API Endpoints:**
```
POST   /api/documents              # Create document
GET    /api/documents/:slug        # Get document
PUT    /api/documents/:slug        # Update document
GET    /api/documents/:slug/revisions
GET    /api/documents/:slug/diff/:r1/:r2
```

**Data Model:**
```sql
-- Documents
CREATE TABLE documents (
  id          UUID PRIMARY KEY,
  slug        VARCHAR(12) UNIQUE NOT NULL,
  title       VARCHAR(255),
  source_url  TEXT,                    -- Original URL if from extension
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Revisions (full content snapshots)
CREATE TABLE revisions (
  id          UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revisions_document ON revisions(document_id, created_at DESC);
```

**Deliverables:**
- Go API server
- PostgreSQL schema
- Docker compose for local dev

---

### Phase 5: Cloud Integration

**Goal:** Extension + Cloud working together

**Scope:**
- Extension "Share" button → creates cloud document
- Shareable URL: `md.lanu.team/d/abc123`
- Web viewer (same rendering as extension)
- Revision history view
- Diff view between revisions

**Deliverables:**
- Extension share functionality
- Web viewer at md.lanu.team
- Revision/diff UI

---

### Phase 6: Polish & Future

**Potential features:**
- User accounts (Gitea OAuth)
- Private documents
- Custom shortcuts (extension settings)
- Real-time collaboration
- Embed support
- Fork document
- Comments
- Export options (PDF, HTML)

---

## Phase 1: Detailed Implementation

### 1.1 Restructure to Monorepo

**Tasks:**
1. Create packages/ directory structure
2. Move app code to packages/app/
3. Extract shared styles to packages/shared/
4. Update imports and build configs
5. Test app still works

**Files to move:**
```
src/              → packages/app/src/
src-tauri/        → packages/app/src-tauri/
src-wasm/         → packages/app/src-wasm/
tests/            → packages/app/tests/
index.html        → packages/app/index.html
vite.config.ts    → packages/app/vite.config.ts
tsconfig.json     → packages/app/tsconfig.json

src/styles/theme.css     → packages/shared/styles/theme.css
src/styles/markdown.css  → packages/shared/styles/markdown.css
src/styles/print.css     → packages/shared/styles/print.css
```

### 1.2 Create Extension Package

**Structure:**
```
packages/extension/
├── package.json
├── manifest.json
├── tsconfig.json
├── build.ts              # Bundle script
├── src/
│   ├── content.ts        # Main content script
│   ├── detector.ts       # URL pattern detection
│   ├── renderer.ts       # Markdown rendering
│   ├── toc.ts            # Table of contents
│   └── shortcuts.ts      # Keyboard shortcuts
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── dist/                 # Built extension (gitignored)
```

### 1.3 Extension Manifest (v3)

```json
{
  "manifest_version": 3,
  "name": "MD - Markdown Viewer",
  "version": "0.1.0",
  "description": "Beautiful markdown rendering for raw .md files",
  "permissions": ["activeTab", "storage"],
  "content_scripts": [
    {
      "matches": [
        "*://*/*.md",
        "*://*/raw/*/*.md",
        "*://raw.githubusercontent.com/*"
      ],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_end"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### 1.4 URL Detection Patterns

**Supported patterns:**
- `*.md` files served as text/plain
- `*/raw/branch/*/*.md` (Gitea)
- `*/raw/*/*.md` (GitLab)
- `raw.githubusercontent.com/*` (GitHub)
- Any URL ending in `.md` with text content

**Detection logic:**
```typescript
function shouldRender(): boolean {
  const url = window.location.href;
  const contentType = document.contentType;
  
  // Must be .md URL
  if (!url.endsWith('.md')) return false;
  
  // Must be plain text (not already rendered HTML)
  if (contentType && !contentType.includes('text/plain')) return false;
  
  // Check if body is just text (not HTML structure)
  const body = document.body;
  if (body.children.length > 1) return false;
  
  return true;
}
```

### 1.5 Rendering Pipeline

```
Raw .md text
    ↓
Extract from <pre> or body.textContent
    ↓
markdown-it parse
    ↓
Shiki highlight code blocks
    ↓
Mermaid render diagrams
    ↓
Build TOC from headings
    ↓
Inject styled HTML + CSS
```

### 1.6 Features for Phase 1

| Feature | Implementation |
|---------|----------------|
| **Theme** | CSS variables + `prefers-color-scheme` media query |
| **TOC** | Build from h1-h6, slide-in panel |
| **Ctrl+G** | Toggle TOC, preventDefault to override browser |
| **Syntax highlight** | Shiki with bundled themes |
| **Mermaid** | Lazy load, render ```mermaid blocks |
| **Scroll position** | Remember position in sessionStorage |

### 1.7 Build Process

Using bun to bundle:

```typescript
// packages/extension/build.ts
await Bun.build({
  entrypoints: ['./src/content.ts'],
  outdir: './dist',
  minify: true,
  target: 'browser',
});

// Copy static files
await copyStyles();   // From @md/shared
await copyManifest();
await copyIcons();
```

### 1.8 Development Workflow

```bash
# From monorepo root
bun install                    # Install all workspaces
bun run --filter @md/extension build  # Build extension
bun run --filter @md/extension watch  # Watch mode

# Load in Chrome
# 1. chrome://extensions
# 2. Enable Developer mode
# 3. Load unpacked → packages/extension/dist
```

### 1.9 Testing

- Manual: Load extension, open raw .md URLs
- Test URLs:
  - GitHub raw files
  - Gitea raw files
  - Plain .md files on any server

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Extension MVP | 2-3 days | None |
| Phase 2: Edit Mode | 1-2 days | Phase 1 |
| Phase 3: Deep Link | 1-2 days | Phase 1 |
| Phase 4: Cloud Backend | 3-4 days | None |
| Phase 5: Cloud Integration | 2-3 days | Phase 4 |
| Phase 6: Polish | Ongoing | All |

**Phase 1 breakdown:**
- Monorepo restructure: 2-3 hours
- Extension scaffold: 1-2 hours
- Content script + detection: 2-3 hours
- Rendering + styling: 3-4 hours
- TOC + shortcuts: 2-3 hours
- Testing + polish: 2-3 hours

---

## Known Limitations

### No `file://` URL Support

The extension does not support local `file://` URLs. This is intentional.

**Why:** Syntax highlighting (Shiki) and diagrams (Mermaid) are loaded on-demand from esm.sh CDN to keep the extension small (~116KB). Dynamic imports from CDN are blocked on `file://` URLs due to browser security (CORS).

**Alternatives considered:**
1. **Bundle shiki + mermaid** — Would increase extension size to ~12MB (shiki alone is ~6MB with all grammars). Unacceptable.
2. **Use lighter libraries** — highlight.js (~500KB) is smaller but still significant. Sugar-high (~20KB) only supports JS/JSX.
3. **Web accessible resources** — Bundle as separate files, lazy-load from extension. Still ~12MB install size.
4. **Per-language loading** — Shiki supports this, but still requires bundling core (~50KB) + grammars. Complex build process.

**Recommendation:** For local files, use the MD desktop app. The extension is designed for viewing raw markdown on the web (GitHub, GitLab, Gitea, etc.).

---

## Open Questions

1. **Extension name:** "MD" or "MD Viewer" or "Markdown Viewer"?
2. **Publish to Chrome Web Store?** Requires $5 developer account
3. **Firefox support?** Manifest v3 works, minor tweaks needed
4. **Cloud auth:** Anonymous first, then Gitea OAuth?
5. **Cloud domain:** md.lanu.team or separate domain?

---

## Next Steps

1. ✅ Create this plan
2. ⏳ Restructure to monorepo (packages/app, packages/shared)
3. ⏳ Scaffold extension package
4. ⏳ Implement content script with detection
5. ⏳ Add rendering pipeline
6. ⏳ Add TOC and shortcuts
7. ⏳ Test and polish
