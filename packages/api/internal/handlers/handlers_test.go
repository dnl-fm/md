package handlers

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	Health(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", contentType)
	}
}

func TestRenderMermaidInvalidTheme(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/render/mermaid/{theme}/{hash}", RenderMermaid)

	req := httptest.NewRequest(http.MethodGet, "/render/mermaid/invalid/abc123", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestRenderMermaidInvalidBase64(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/render/mermaid/{theme}/{hash}", RenderMermaid)

	req := httptest.NewRequest(http.MethodGet, "/render/mermaid/dark/abc123?code=invalid!!!", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestRenderMermaidHashMismatch(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/render/mermaid/{theme}/{hash}", RenderMermaid)

	code := "graph TD\n  A-->B"
	encoded := base64.URLEncoding.EncodeToString([]byte(code))
	wrongHash := "wronghash123"

	req := httptest.NewRequest(http.MethodGet, "/render/mermaid/dark/"+wrongHash+"?code="+encoded, nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestRenderASCIIInvalidBase64(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/render/ascii/{hash}", RenderASCII)

	req := httptest.NewRequest(http.MethodGet, "/render/ascii/abc123?code=invalid!!!", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestRenderASCIIHashMismatch(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/render/ascii/{hash}", RenderASCII)

	code := "box \"Hello\""
	encoded := base64.URLEncoding.EncodeToString([]byte(code))
	wrongHash := "wronghash123"

	req := httptest.NewRequest(http.MethodGet, "/render/ascii/"+wrongHash+"?code="+encoded, nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestHashGeneration(t *testing.T) {
	code := "graph TD\n  A-->B"
	hash := sha256.Sum256([]byte(code))
	expected := hex.EncodeToString(hash[:])

	if len(expected) != 64 {
		t.Errorf("expected hash length 64, got %d", len(expected))
	}
}
