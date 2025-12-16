# API Integration

The MD extension now uses server-side rendering for Mermaid and ASCII diagrams via `api.getmd.dev`.

## Changes from WASM/Client-Side Rendering

### Before
- **Mermaid**: Loaded 1.5MB mermaid library from CDN at runtime
- **ASCII**: Loaded 108KB WASM module bundled with extension
- **Total overhead**: ~1.6MB loaded per page

### After
- **Mermaid**: API call to `api.getmd.dev/render/mermaid/{theme}/{hash}`
- **ASCII**: API call to `api.getmd.dev/render/ascii/{hash}`
- **Total overhead**: ~2KB (api.ts utility module)
- **Extension size**: 284KB (down from 400KB - removed WASM)

## API Integration Details

### Module: `src/api.ts`

Provides two functions:

#### `renderMermaid(code: string, theme: "dark" | "light"): Promise<string | null>`
- Computes SHA-256 hash of code
- Encodes code as URL-safe base64
- Fetches SVG from API
- Returns SVG string or null on error

#### `renderASCII(code: string): Promise<string | null>`
- Computes SHA-256 hash of code
- Encodes code as URL-safe base64
- Fetches rendered text from API
- Returns text or null on error

### Content Script Updates

Both `renderMermaidDiagrams()` and `renderAsciiDiagrams()` now:
1. Show loading state while fetching from API
2. Replace loading state with rendered content on success
3. Fall back to raw code block on error
4. Log warnings for debugging

### Loading States

Added CSS animations for loading indicators:
- `.mermaid-loading` - Pulsing "Loading diagram..." text
- `.ascii-loading` - Same for ASCII diagrams

### Error Handling

If API fails (network error, server error, invalid syntax):
- Extension logs warning to console
- Falls back to displaying raw code in a `<pre><code>` block
- User can still see the source code

### Manifest Changes

Added `host_permissions`:
```json
"host_permissions": ["https://api.getmd.dev/*"]
```

This allows the extension to make fetch requests to the API server.

## Benefits

### Performance
- **First load**: Slightly slower due to API round-trip (~100-500ms)
- **Cached renders**: Very fast (<10ms via nginx cache)
- **Bundle size**: 29% smaller (400KB → 284KB)

### Reliability
- No CSP violations (Manifest V3 compliant)
- No dynamic script loading
- No WASM compatibility issues
- Server-side rendering = consistent results

### Maintenance
- Rendering logic centralized on server
- Can update mermaid/ASCII versions without extension update
- Easier to debug (server logs)

## Testing

### Manual Testing Required

1. Load extension in Chrome:
   ```
   chrome://extensions
   → Enable Developer mode
   → Load unpacked
   → Select packages/extension/dist
   ```

2. Test Mermaid rendering:
   - Create a `.md` file with mermaid diagram
   - Open in browser
   - Verify diagram renders (or shows loading state)
   - Toggle dark/light theme
   - Verify diagram re-renders with correct theme

3. Test ASCII rendering:
   - Create a `.md` file with ASCII diagram
   - Open in browser
   - Verify diagram renders

4. Test error handling:
   - Create invalid mermaid syntax
   - Verify fallback to raw code block
   - Check console for warning message

5. Test offline/API down:
   - Disable network or block api.getmd.dev
   - Verify graceful fallback to raw code

### Network Tab Verification

In Chrome DevTools → Network:
- Should see requests to `api.getmd.dev/render/...`
- First request: 200 OK, X-Cache-Status: MISS
- Second request (same diagram): 200 OK, X-Cache-Status: HIT
- Failed requests should not break the page

## Configuration

API base URL is hardcoded in `src/api.ts`:
```typescript
const API_BASE = "https://api.getmd.dev";
```

For development/testing, change to:
```typescript
const API_BASE = "http://localhost:8080";
```

## Deployment Checklist

- [ ] API server deployed at api.getmd.dev
- [ ] Nginx caching configured
- [ ] SSL certificate installed
- [ ] CORS headers enabled
- [ ] Rate limiting configured
- [ ] Extension tested with production API
- [ ] Extension published to Chrome Web Store
