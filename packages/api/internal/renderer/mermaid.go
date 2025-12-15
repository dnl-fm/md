package renderer

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
)

// MermaidRenderer handles mermaid diagram rendering using chromedp
type MermaidRenderer struct {
	ctx    context.Context
	cancel context.CancelFunc
	mu     sync.Mutex
	ready  bool
}

// NewMermaidRenderer creates a new renderer with a warm browser context
func NewMermaidRenderer() (*MermaidRenderer, error) {
	// Create allocator context with headless-shell
	allocCtx, cancel := chromedp.NewExecAllocator(
		context.Background(),
		chromedp.NoFirstRun,
		chromedp.NoDefaultBrowserCheck,
		chromedp.Headless,
		chromedp.DisableGPU,
	)

	// Create browser context
	ctx, _ := chromedp.NewContext(allocCtx)

	r := &MermaidRenderer{
		ctx:    ctx,
		cancel: cancel,
	}

	// Warm up the page with mermaid library
	if err := r.warmup(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to warm up browser: %w", err)
	}

	r.ready = true
	return r, nil
}

// warmup initializes a page with mermaid library loaded
func (r *MermaidRenderer) warmup() error {
	html := `<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ 
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict'
    });
    window.mermaid = mermaid;
    window.mermaidReady = true;
  </script>
</head>
<body>
  <div id="diagram"></div>
</body>
</html>`

	ctx, cancel := context.WithTimeout(r.ctx, 10*time.Second)
	defer cancel()

	var ready bool
	err := chromedp.Run(ctx,
		chromedp.Navigate("data:text/html,"+html),
		chromedp.WaitReady("body"),
		chromedp.EvaluateAsDevTools(`window.mermaidReady === true`, &ready),
	)

	if err != nil {
		return fmt.Errorf("warmup failed: %w", err)
	}

	if !ready {
		return fmt.Errorf("mermaid library not loaded")
	}

	return nil
}

// Render renders a mermaid diagram to SVG
func (r *MermaidRenderer) Render(code string, theme string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.ready {
		return "", fmt.Errorf("renderer not ready")
	}

	ctx, cancel := context.WithTimeout(r.ctx, 30*time.Second)
	defer cancel()

	// Set theme
	var svg string
	err := chromedp.Run(ctx,
		chromedp.Evaluate(fmt.Sprintf(`
			window.mermaid.initialize({ theme: '%s' });
			const { svg } = await window.mermaid.render('diagram', %s);
			svg;
		`, theme, jsonEscape(code)), &svg),
	)

	if err != nil {
		return "", fmt.Errorf("render failed: %w", err)
	}

	return svg, nil
}

// Close shuts down the browser context
func (r *MermaidRenderer) Close() error {
	if r.cancel != nil {
		r.cancel()
	}
	return nil
}

// jsonEscape escapes a string for use in JavaScript
func jsonEscape(s string) string {
	// Simple JSON string escaping
	return fmt.Sprintf("`%s`", s)
}
