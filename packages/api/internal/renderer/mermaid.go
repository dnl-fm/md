package renderer

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
)

type MermaidRenderer struct {
	ctx    context.Context
	cancel context.CancelFunc
	mu     sync.Mutex
	ready  bool
}

func NewMermaidRenderer() (*MermaidRenderer, error) {
	allocCtx, allocCancel := chromedp.NewExecAllocator(
		context.Background(),
		chromedp.NoFirstRun,
		chromedp.NoDefaultBrowserCheck,
		chromedp.Headless,
		chromedp.DisableGPU,
		chromedp.NoSandbox,
	)

	browserCtx, browserCancel := chromedp.NewContext(allocCtx)

	r := &MermaidRenderer{
		ctx: browserCtx,
		cancel: func() {
			browserCancel()
			allocCancel()
		},
	}

	if err := r.warmup(); err != nil {
		r.cancel()
		return nil, fmt.Errorf("failed to warm up browser: %w", err)
	}

	r.ready = true
	return r, nil
}

func (r *MermaidRenderer) warmup() error {
	html := `<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
    window.mermaid = mermaid;
    window.mermaidReady = true;
    window.renderResult = null;
    window.renderDone = false;
    window.renderDiagram = async (code, theme) => {
      window.renderDone = false;
      window.renderResult = null;
      try {
        mermaid.initialize({ theme: theme, securityLevel: 'strict' });
        const result = await mermaid.render('diagram', code);
        window.renderResult = { svg: result.svg, error: null };
      } catch(e) {
        window.renderResult = { svg: null, error: e.message };
      }
      window.renderDone = true;
    };
  </script>
</head>
<body><div id="diagram"></div></body>
</html>`

	var ready bool
	err := chromedp.Run(r.ctx,
		chromedp.Navigate("data:text/html,"+html),
		chromedp.WaitReady("body"),
		chromedp.Sleep(2*time.Second),
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

func (r *MermaidRenderer) Render(code string, theme string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.ready {
		return "", fmt.Errorf("renderer not ready")
	}

	// Start render
	jsCode := fmt.Sprintf(`window.renderDiagram(%q, %q)`, code, theme)
	err := chromedp.Run(r.ctx,
		chromedp.Evaluate(jsCode, nil),
	)
	if err != nil {
		return "", fmt.Errorf("render call failed: %w", err)
	}

	// Poll for completion (max 30s)
	var done bool
	for i := 0; i < 300; i++ {
		err = chromedp.Run(r.ctx,
			chromedp.Evaluate(`window.renderDone`, &done),
		)
		if err != nil {
			return "", fmt.Errorf("poll failed: %w", err)
		}
		if done {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	if !done {
		return "", fmt.Errorf("render timeout")
	}

	// Get result
	var result struct {
		SVG   string `json:"svg"`
		Error string `json:"error"`
	}
	err = chromedp.Run(r.ctx,
		chromedp.Evaluate(`window.renderResult`, &result),
	)
	if err != nil {
		return "", fmt.Errorf("get result failed: %w", err)
	}

	if result.Error != "" {
		return "", fmt.Errorf("mermaid error: %s", result.Error)
	}

	if result.SVG == "" {
		return "", fmt.Errorf("empty SVG returned")
	}

	return result.SVG, nil
}

func (r *MermaidRenderer) Close() error {
	if r.cancel != nil {
		r.cancel()
	}
	return nil
}
