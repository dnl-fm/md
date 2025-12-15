# Publishing MD Extension

## Chrome Web Store

**Developer Console:** https://chrome.google.com/webstore/devconsole

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
Beautiful markdown rendering for raw .md files. View GitHub, GitLab, and Gitea markdown with syntax highlighting and diagrams.
```

**Detailed description:**
```
MD transforms raw markdown files into beautifully rendered documents directly in your browser.

Features:
• Automatic detection of raw .md files (GitHub, GitLab, Gitea, etc.)
• Light and dark theme (follows system preference)
• Table of contents navigation (Ctrl+G)
• Syntax highlighting for code blocks
• Mermaid diagram support
• Print/PDF export (Ctrl+P)
• Customizable font size
• Full width toggle
• Clean, distraction-free reading experience

Keyboard shortcuts:
• Ctrl+G - Table of contents
• Ctrl+T - Toggle theme
• Ctrl+U - Toggle raw markdown
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

**Host permissions (`*://*/*.md`, `*://*/*.markdown`, etc.):**
```
The extension detects and renders raw markdown files (.md, .markdown) served as plain text. It requires broad URL matching to work on any website hosting markdown files (GitHub, GitLab, Gitea, Bitbucket, self-hosted repositories, etc.). The extension only activates on URLs ending in .md or .markdown that serve plain text content. No data is collected or transmitted - all rendering happens locally in the browser.
```

**Storage permission:**
```
To save user preferences (theme, font size, full width toggle) locally using chrome.storage.local. Data never leaves the device.
```

### Remote Code

**Does the extension use remote code?** Yes

```
Syntax highlighting (Shiki) and diagram rendering (Mermaid) are loaded on-demand from esm.sh CDN. This keeps the extension lightweight (~73KB vs ~12MB if bundled). These libraries are loaded only when the page contains code blocks or mermaid diagrams. No user data is sent to these services.
```

### Data Usage

```
No user data is collected or transmitted. All processing happens locally.
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
