package handlers

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"time"

	"github.com/dnl-fm/md/packages/api/internal/renderer"
	"github.com/go-chi/chi/v5"
)

var mermaidRenderer *renderer.MermaidRenderer

func InitializeRenderers() error {
	var err error
	mermaidRenderer, err = renderer.NewMermaidRenderer()
	if err != nil {
		return fmt.Errorf("failed to initialize mermaid renderer: %w", err)
	}
	return nil
}

func CloseRenderers() {
	if mermaidRenderer != nil {
		mermaidRenderer.Close()
	}
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func RenderMermaid(w http.ResponseWriter, r *http.Request) {
	theme := chi.URLParam(r, "theme")
	hash := chi.URLParam(r, "hash")
	codeB64 := r.URL.Query().Get("code")

	if theme != "dark" && theme != "light" {
		respondError(w, "invalid theme, must be 'dark' or 'light'", http.StatusBadRequest)
		return
	}

	code, err := base64.URLEncoding.DecodeString(codeB64)
	if err != nil {
		code, err = base64.RawURLEncoding.DecodeString(codeB64)
		if err != nil {
			respondError(w, "invalid base64", http.StatusBadRequest)
			return
		}
	}

	computed := sha256.Sum256(code)
	computedHash := hex.EncodeToString(computed[:])
	if computedHash != hash {
		respondError(w, "hash mismatch", http.StatusBadRequest)
		return
	}

	svg, err := mermaidRenderer.Render(string(code), theme)
	if err != nil {
		respondError(w, fmt.Sprintf("render failed: %s", err.Error()), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=2592000")
	w.Write([]byte(svg))
}

func RenderASCII(w http.ResponseWriter, r *http.Request) {
	hash := chi.URLParam(r, "hash")
	codeB64 := r.URL.Query().Get("code")

	code, err := base64.URLEncoding.DecodeString(codeB64)
	if err != nil {
		code, err = base64.RawURLEncoding.DecodeString(codeB64)
		if err != nil {
			respondError(w, "invalid base64", http.StatusBadRequest)
			return
		}
	}

	computed := sha256.Sum256(code)
	computedHash := hex.EncodeToString(computed[:])
	if computedHash != hash {
		respondError(w, "hash mismatch", http.StatusBadRequest)
		return
	}

	// Execute ascii renderer with 5 second timeout
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ascii")
	cmd.Stdin = bytes.NewReader(code)
	output, err := cmd.Output()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			respondError(w, "render timeout: diagram too complex or has cycles", http.StatusBadRequest)
			return
		}
		if exitErr, ok := err.(*exec.ExitError); ok {
			respondError(w, fmt.Sprintf("render failed: %s", string(exitErr.Stderr)), http.StatusBadRequest)
		} else {
			respondError(w, fmt.Sprintf("render failed: %s", err.Error()), http.StatusBadRequest)
		}
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=2592000")
	w.Write(output)
}

func respondError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}
