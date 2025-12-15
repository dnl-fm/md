package handlers

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/dnl-fm/md/packages/api/internal/renderer"
	"github.com/go-chi/chi/v5"
)

var mermaidRenderer *renderer.MermaidRenderer

// InitializeRenderers sets up the warm mermaid renderer
func InitializeRenderers() error {
	var err error
	mermaidRenderer, err = renderer.NewMermaidRenderer()
	if err != nil {
		return fmt.Errorf("failed to initialize mermaid renderer: %w", err)
	}
	return nil
}

// CloseRenderers shuts down renderers gracefully
func CloseRenderers() {
	if mermaidRenderer != nil {
		mermaidRenderer.Close()
	}
}

type ErrorResponse struct {
	Error string `json:"error"`
}

// Health check endpoint
func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// RenderMermaid renders a mermaid diagram to SVG
func RenderMermaid(w http.ResponseWriter, r *http.Request) {
	theme := chi.URLParam(r, "theme")
	hash := chi.URLParam(r, "hash")
	codeB64 := r.URL.Query().Get("code")

	// Validate theme
	if theme != "dark" && theme != "light" {
		respondError(w, "invalid theme, must be 'dark' or 'light'", http.StatusBadRequest)
		return
	}

	// Decode base64
	code, err := base64.URLEncoding.DecodeString(codeB64)
	if err != nil {
		// Try URL-safe base64
		code, err = base64.RawURLEncoding.DecodeString(codeB64)
		if err != nil {
			respondError(w, "invalid base64", http.StatusBadRequest)
			return
		}
	}

	// Verify hash matches content
	computed := sha256.Sum256(code)
	computedHash := hex.EncodeToString(computed[:])
	if computedHash != hash {
		respondError(w, "hash mismatch", http.StatusBadRequest)
		return
	}

	// Render using chromedp (fast, warm page)
	svg, err := mermaidRenderer.Render(string(code), theme)
	if err != nil {
		respondError(w, fmt.Sprintf("render failed: %s", err.Error()), http.StatusBadRequest)
		return
	}

	// Return SVG
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=2592000") // 30 days
	w.Write([]byte(svg))
}

// RenderASCII renders ASCII diagram to text
func RenderASCII(w http.ResponseWriter, r *http.Request) {
	hash := chi.URLParam(r, "hash")
	codeB64 := r.URL.Query().Get("code")

	// Decode base64
	code, err := base64.URLEncoding.DecodeString(codeB64)
	if err != nil {
		// Try URL-safe base64
		code, err = base64.RawURLEncoding.DecodeString(codeB64)
		if err != nil {
			respondError(w, "invalid base64", http.StatusBadRequest)
			return
		}
	}

	// Verify hash matches content
	computed := sha256.Sum256(code)
	computedHash := hex.EncodeToString(computed[:])
	if computedHash != hash {
		respondError(w, "hash mismatch", http.StatusBadRequest)
		return
	}

	// Execute ASCII CLI (assume it's in PATH as 'ascii-diagram')
	// This will need to be replaced with the actual ASCII renderer CLI path
	cmd := exec.Command("ascii-diagram")
	cmd.Stdin = nil // Will read from stdin
	
	// Create temp file for input
	tmpDir := os.TempDir()
	tmpFile := filepath.Join(tmpDir, hash+".txt")
	if err := os.WriteFile(tmpFile, code, 0644); err != nil {
		respondError(w, "failed to write temp file", http.StatusInternalServerError)
		return
	}
	defer os.Remove(tmpFile)

	// Read from file instead
	cmd = exec.Command("ascii-diagram", tmpFile)
	output, err := cmd.CombinedOutput()
	if err != nil {
		respondError(w, fmt.Sprintf("render failed: %s", string(output)), http.StatusBadRequest)
		return
	}

	// Return rendered diagram
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=2592000") // 30 days
	w.Write(output)
}

// respondError sends a JSON error response
func respondError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}
