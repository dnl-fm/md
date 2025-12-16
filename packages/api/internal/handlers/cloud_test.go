package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestCloudSyncEndpoints(t *testing.T) {
	// Initialize test database
	tmpDir := t.TempDir()
	InitCloudDB(tmpDir)

	// Create router
	r := chi.NewRouter()
	r.Get("/v1/cloud/documents", ListDocuments)
	r.Post("/v1/cloud/documents", CreateDocument)
	r.Get("/v1/cloud/documents/{id}", GetDocument)
	r.Put("/v1/cloud/documents/{id}", UpdateDocument)
	r.Delete("/v1/cloud/documents/{id}", DeleteDocument)

	// Test: Create document
	t.Run("CreateDocument", func(t *testing.T) {
		body := map[string]interface{}{
			"title":   "Test Document",
			"content": "# Test\n\nThis is a test document.",
		}
		bodyJSON, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/v1/cloud/documents", bytes.NewReader(bodyJSON))
		req.Header.Set("X-Dev-User", "dev-user-001")
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Errorf("expected status 201, got %d: %s", w.Code, w.Body.String())
		}

		var response map[string]interface{}
		if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if response["id"] == nil {
			t.Error("expected id in response")
		}
		if response["title"] != "Test Document" {
			t.Errorf("expected title 'Test Document', got %v", response["title"])
		}
	})

	// Test: List documents
	t.Run("ListDocuments", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/cloud/documents", nil)
		req.Header.Set("X-Dev-User", "dev-user-001")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var response map[string]interface{}
		if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		documents := response["documents"].([]interface{})
		if len(documents) == 0 {
			t.Error("expected at least one document")
		}
	})

	// Test: Get document (need to create one first)
	var createdID string
	t.Run("GetDocument", func(t *testing.T) {
		// Create a document first
		body := map[string]interface{}{
			"title":   "Get Test",
			"content": "# Get Test Content",
		}
		bodyJSON, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/v1/cloud/documents", bytes.NewReader(bodyJSON))
		req.Header.Set("X-Dev-User", "dev-user-001")
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		var createResp map[string]interface{}
		json.NewDecoder(w.Body).Decode(&createResp)
		createdID = createResp["id"].(string)

		// Now get it
		req = httptest.NewRequest(http.MethodGet, "/v1/cloud/documents/"+createdID, nil)
		req.Header.Set("X-Dev-User", "dev-user-001")
		w = httptest.NewRecorder()

		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		var doc map[string]interface{}
		if err := json.NewDecoder(w.Body).Decode(&doc); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if doc["content"] != "# Get Test Content" {
			t.Errorf("expected content '# Get Test Content', got %v", doc["content"])
		}
	})

	// Test: Update document
	t.Run("UpdateDocument", func(t *testing.T) {
		if createdID == "" {
			t.Skip("no document created")
		}

		body := map[string]interface{}{
			"content": "# Updated Content",
		}
		bodyJSON, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPut, "/v1/cloud/documents/"+createdID, bytes.NewReader(bodyJSON))
		req.Header.Set("X-Dev-User", "dev-user-001")
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	// Test: Delete document
	t.Run("DeleteDocument", func(t *testing.T) {
		if createdID == "" {
			t.Skip("no document created")
		}

		req := httptest.NewRequest(http.MethodDelete, "/v1/cloud/documents/"+createdID, nil)
		req.Header.Set("X-Dev-User", "dev-user-001")

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", w.Code)
		}
	})

	// Test: Unauthorized request
	t.Run("UnauthorizedRequest", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/cloud/documents", nil)
		// No X-Dev-User header
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", w.Code)
		}
	})

	// Cleanup
	os.RemoveAll(tmpDir)
}
