# Publishing MD Extension

## Chrome Web Store

**Publisher ID:** `11e37918-dbfb-4776-b26c-a09f45e9ce01`

**Developer Console:** https://chrome.google.com/webstore/devconsole

### Steps to Publish

1. **Build the extension**
   ```bash
   make build-ext
   ```

2. **Create ZIP for upload**
   ```bash
   cd packages/extension/dist
   zip -r ../md-extension.zip .
   ```

3. **Upload to Chrome Web Store**
   - Go to Developer Console
   - Click "New Item"
   - Upload `md-extension.zip`
   - Fill in store listing details

### Store Listing Details

**Name:** MD

**Short description (132 chars max):**
Beautiful markdown rendering for raw .md files. View GitHub, GitLab, and Gitea markdown with syntax highlighting and diagrams.

**Detailed description:**
MD transforms raw markdown files into beautifully rendered documents directly in your browser.

Features:
• Automatic detection of raw .md files (GitHub, GitLab, Gitea, etc.)
• Light and dark theme (follows system preference)
• Table of contents navigation (Ctrl+G)
• Syntax highlighting for code blocks
• Mermaid diagram support
• Clean, distraction-free reading experience

Keyboard shortcuts:
• Ctrl+G - Toggle table of contents
• Ctrl+T - Toggle theme

**Category:** Productivity

**Language:** English

### Required Assets

- [ ] Icon 128x128 (store listing)
- [ ] Screenshot 1280x800 or 640x400
- [ ] Promotional tile 440x280 (optional)

### Privacy

**Single purpose:** Render markdown files in the browser

**Permissions justification:**
- `activeTab` - To detect and render markdown content on the current tab
- `storage` - To save user theme preference

**Data usage:** No user data is collected or transmitted. All processing happens locally.

---

## Firefox Add-ons

**Developer Hub:** https://addons.mozilla.org/developers/

Same ZIP can be uploaded with minor manifest adjustments (if needed).

---

## Version Checklist

Before publishing a new version:

1. [ ] Update version in `package.json`
2. [ ] Update version in `manifest.json`
3. [ ] Test locally
4. [ ] Build: `make build-ext`
5. [ ] Create ZIP
6. [ ] Upload to stores
