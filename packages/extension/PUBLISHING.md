# Publishing MD Extension

## Chrome Web Store

**Developer Console:** https://chrome.google.com/webstore/devconsole

**Extension ID:** `heagnonehdabjameokpjkbneplkkiifp`

**Store URL:** https://chromewebstore.google.com/detail/md/heagnonehdabjameokpjkbneplkkiifp

### Steps to Publish

1. **Build the extension**
   ```bash
   cd packages/extension
   bun run build
   ```

2. **Create ZIP for upload**
   ```bash
   cd packages/extension/dist
   zip -r ../md-extension.zip .
   ```

3. **Upload to Chrome Web Store**
   - Go to Developer Console
   - Click "New Item" (or select existing)
   - Upload `md-extension.zip`
   - Fill in store listing details

---

## Store Listing Details

### Basic Info

**Name:** MD

**Category:** Developer Tools

**Language:** English

### Description

**Short description (132 chars max):**
```
Render raw .md files beautifully. Reader mode for any webpage. Syntax highlighting, Mermaid & ASCII diagrams, dark/light theme.
```

**Detailed description:**
```
MD transforms raw markdown files into beautifully rendered documents directly in your browser.

Features:
• Automatic detection of raw .md files (GitHub, GitLab, Gitea, etc.)
• Reader mode: convert any webpage to clean markdown (press M)
• Light and dark theme (follows system preference)
• Table of contents navigation (Ctrl+G)
• Syntax highlighting for code blocks
• Mermaid diagram support
• ASCII diagram support (flowchart, ERD, sequence, etc.)
• Print/PDF export (Ctrl+P)
• Customizable font size
• Full width toggle
• Clean, distraction-free reading experience

Keyboard shortcuts:
• M - Reader mode (convert page to markdown)
• Ctrl+G - Table of contents
• Ctrl+T - Toggle theme
• Ctrl+P - Print / PDF
• Ctrl+H - Help
• Ctrl++/- - Font size
```

---

## Privacy Tab

### Single Purpose

```
Render markdown files in the browser
```

### Permissions Justification

**Host permissions (`<all_urls>`):**
```
The extension detects and renders raw markdown files (.md, .markdown) served as plain text. It requires broad URL matching to work on any website hosting markdown files (GitHub, GitLab, Gitea, Bitbucket, self-hosted repositories, etc.). The extension only activates on URLs ending in .md or .markdown that serve plain text content. Mermaid and ASCII diagrams are rendered via api.getmd.dev (returns SVG/text). No user data is collected.
```

**Storage permission:**
```
To save user preferences (theme, font size, full width toggle) locally using chrome.storage.local. Data never leaves the device.
```

**Scripting permission:**
```
Required for the reader mode feature. When the user presses 'M' on any webpage, the extension converts the page content to clean markdown for distraction-free reading. This requires programmatic access to read and transform the current page's DOM. No data is collected or transmitted.
```

**ActiveTab permission:**
```
Allows the extension to access the current tab when the user clicks the extension icon. Used to toggle reader mode on demand without requiring persistent access to all tabs.
```

### Remote Code

**Does the extension use remote code?** No

```
All code is bundled within the extension. Syntax highlighting uses Prism.js (bundled). Mermaid and ASCII diagrams are rendered via an API (api.getmd.dev) that returns pre-rendered SVG/text output, not executable code. No remote JavaScript is loaded or executed.
```

### Data Usage

```
No user data is collected. Diagram code (Mermaid/ASCII) is sent to api.getmd.dev for server-side rendering. Only the diagram source code is transmitted, no personal or browsing data.
```

### Privacy Policy URL

```
https://github.com/dnl-fm/md/blob/main/packages/extension/PRIVACY.md
```

---

## Required Assets

| Asset | Size | Status |
|-------|------|--------|
| Icon | 128x128 | ✅ `icons/icon128.png` |
| Screenshot | 1280x800 or 640x400 | ❌ TODO |
| Promo tile (optional) | 440x280 | ❌ TODO |

---

## Automated Publishing

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `CHROME_EXTENSION_ID` | Extension ID from store URL |
| `CHROME_CLIENT_ID` | Google Cloud OAuth client ID |
| `CHROME_CLIENT_SECRET` | Google Cloud OAuth client secret |
| `CHROME_REFRESH_TOKEN` | OAuth refresh token |

### Setup OAuth Credentials

1. Go to https://console.cloud.google.com/
2. Enable "Chrome Web Store API"
3. Create OAuth credentials (Desktop app)
4. Add yourself as test user in OAuth consent screen
5. Get refresh token:
   ```bash
   # Open auth URL, authorize, get code
   CLIENT_ID="your-client-id"
   echo "https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=${CLIENT_ID}&redirect_uri=http://localhost"
   
   # Exchange code for refresh token
   curl "https://oauth2.googleapis.com/token" \
     -d "client_id=${CLIENT_ID}" \
     -d "client_secret=${CLIENT_SECRET}" \
     -d "code=${CODE}" \
     -d "grant_type=authorization_code" \
     -d "redirect_uri=http://localhost"
   ```

### Release Workflow

Tag with `ext-v*` to trigger automated build:
```bash
git tag ext-v0.1.1
git push --tags
```

---

## Firefox Add-ons

**Developer Hub:** https://addons.mozilla.org/developers/

Same ZIP can be uploaded. Firefox supports Manifest v3.

---

## Version Checklist

Before publishing a new version:

1. [ ] Update version in `packages/extension/package.json`
2. [ ] Update version in `packages/extension/manifest.json`
3. [ ] Update `VERSION` constant in `src/content.ts`
4. [ ] Update `packages/extension/CHANGELOG.md`
5. [ ] Test locally
6. [ ] Build and create ZIP
7. [ ] Tag release: `git tag ext-v0.x.x && git push --tags`
