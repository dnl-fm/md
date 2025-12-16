package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/dnl-fm/md/packages/api/internal/db"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

var cloudDB *db.CloudDB

// InitCloudDB initializes the cloud database
func InitCloudDB(dataDir string) {
	cloudDB = db.NewCloudDB(dataDir)
}

// getUserID extracts user ID from request (dev mode or auth)
func getUserID(r *http.Request) string {
	// Dev mode: check X-Dev-User header
	if devUser := r.Header.Get("X-Dev-User"); devUser != "" {
		return devUser
	}

	// TODO: Extract from JWT token in Authorization header
	// For now, return empty (will fail authentication)
	return ""
}

// ListDocuments handles GET /v1/cloud/documents
func ListDocuments(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		respondError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse query parameters
	var since *time.Time
	if sinceStr := r.URL.Query().Get("since"); sinceStr != "" {
		t, err := time.Parse(time.RFC3339, sinceStr)
		if err != nil {
			respondError(w, "invalid since parameter", http.StatusBadRequest)
			return
		}
		since = &t
	}

	includeDeleted := r.URL.Query().Get("include_deleted") == "true"

	// Get documents from database
	docs, err := cloudDB.ListDocuments(userID, since, includeDeleted)
	if err != nil {
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Generate sync token (use latest updated_at)
	syncToken := time.Now().Format(time.RFC3339)
	if len(docs) > 0 {
		syncToken = docs[0].UpdatedAt.Format(time.RFC3339)
	}

	response := map[string]interface{}{
		"documents":  docs,
		"sync_token": syncToken,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetDocument handles GET /v1/cloud/documents/{id}
func GetDocument(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		respondError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	docID := chi.URLParam(r, "id")
	if docID == "" {
		respondError(w, "document id required", http.StatusBadRequest)
		return
	}

	doc, err := cloudDB.GetDocument(userID, docID)
	if err != nil {
		if err.Error() == "document not found" {
			respondError(w, "document not found", http.StatusNotFound)
			return
		}
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

// CreateDocumentRequest represents the request body for creating a document
type CreateDocumentRequest struct {
	Title     string  `json:"title"`
	Content   string  `json:"content"`
	SourceURL *string `json:"source_url,omitempty"`
}

// CreateDocument handles POST /v1/cloud/documents
func CreateDocument(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		respondError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		respondError(w, "title is required", http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		respondError(w, "content is required", http.StatusBadRequest)
		return
	}

	// Create document
	doc := &db.Document{
		ID:        uuid.New().String(),
		Title:     req.Title,
		Content:   req.Content,
		SourceURL: req.SourceURL,
	}

	if err := cloudDB.CreateDocument(userID, doc); err != nil {
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Fetch the created document to get timestamps
	created, err := cloudDB.GetDocument(userID, doc.ID)
	if err != nil {
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// UpdateDocumentRequest represents the request body for updating a document
type UpdateDocumentRequest struct {
	Title    *string `json:"title,omitempty"`
	Content  *string `json:"content,omitempty"`
	BaseHash *string `json:"base_hash,omitempty"`
}

// UpdateDocument handles PUT /v1/cloud/documents/{id}
func UpdateDocument(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		respondError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	docID := chi.URLParam(r, "id")
	if docID == "" {
		respondError(w, "document id required", http.StatusBadRequest)
		return
	}

	var req UpdateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Update document
	err := cloudDB.UpdateDocument(userID, docID, req.Title, req.Content, req.BaseHash)
	if err != nil {
		if err.Error() == "conflict: base hash mismatch" {
			// Get current document to return conflict info
			doc, _ := cloudDB.GetDocument(userID, docID)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":             "conflict",
				"server_hash":       doc.ContentHash,
				"server_updated_at": doc.UpdatedAt,
			})
			return
		}
		if err.Error() == "document not found" {
			respondError(w, "document not found", http.StatusNotFound)
			return
		}
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Fetch updated document
	updated, err := cloudDB.GetDocument(userID, docID)
	if err != nil {
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":           updated.ID,
		"updated_at":   updated.UpdatedAt,
		"content_hash": updated.ContentHash,
	})
}

// DeleteDocument handles DELETE /v1/cloud/documents/{id}
func DeleteDocument(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		respondError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	docID := chi.URLParam(r, "id")
	if docID == "" {
		respondError(w, "document id required", http.StatusBadRequest)
		return
	}

	err := cloudDB.DeleteDocument(userID, docID)
	if err != nil {
		if err.Error() == "document not found" {
			respondError(w, "document not found", http.StatusNotFound)
			return
		}
		respondError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
