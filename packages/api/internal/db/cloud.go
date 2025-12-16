package db

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// Document represents a synced markdown document
type Document struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Content     string    `json:"content,omitempty"` // Omit in list responses
	SourceURL   *string   `json:"source_url,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	AccessedAt  time.Time `json:"accessed_at"`
	ContentHash string    `json:"content_hash"`
	SizeBytes   int       `json:"size_bytes"`
	WordCount   int       `json:"word_count"`
	IsDeleted   bool      `json:"is_deleted"`
	DeletedAt   *time.Time `json:"deleted_at,omitempty"`
}

// DocumentListItem is a lightweight document for list responses
type DocumentListItem struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	SourceURL   *string    `json:"source_url,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	AccessedAt  time.Time  `json:"accessed_at"`
	ContentHash string     `json:"content_hash"`
	SizeBytes   int        `json:"size_bytes"`
	WordCount   int        `json:"word_count"`
	IsDeleted   bool       `json:"is_deleted"`
	DeletedAt   *time.Time `json:"deleted_at,omitempty"`
}

// CloudDB manages per-user SQLite databases
type CloudDB struct {
	dataDir string
}

// NewCloudDB creates a new cloud database manager
func NewCloudDB(dataDir string) *CloudDB {
	return &CloudDB{dataDir: dataDir}
}

// getUserDB returns a database connection for a specific user
func (c *CloudDB) getUserDB(userID string) (*sql.DB, error) {
	userDir := filepath.Join(c.dataDir, "users", userID)
	if err := os.MkdirAll(userDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create user directory: %w", err)
	}

	dbPath := filepath.Join(userDir, "documents.db")
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Initialize schema if needed
	if err := c.initSchema(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return db, nil
}

// initSchema creates the documents table if it doesn't exist
func (c *CloudDB) initSchema(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS documents (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		content TEXT NOT NULL,
		source_url TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		content_hash TEXT NOT NULL,
		size_bytes INTEGER NOT NULL,
		word_count INTEGER DEFAULT 0,
		is_deleted INTEGER DEFAULT 0,
		deleted_at DATETIME
	);

	CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
	CREATE INDEX IF NOT EXISTS idx_documents_accessed_at ON documents(accessed_at);
	CREATE INDEX IF NOT EXISTS idx_documents_is_deleted ON documents(is_deleted);
	`

	_, err := db.Exec(schema)
	return err
}

// ListDocuments returns all documents for a user
func (c *CloudDB) ListDocuments(userID string, since *time.Time, includeDeleted bool) ([]DocumentListItem, error) {
	db, err := c.getUserDB(userID)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	query := `
		SELECT id, title, source_url, created_at, updated_at, accessed_at,
		       content_hash, size_bytes, word_count, is_deleted, deleted_at
		FROM documents
		WHERE 1=1
	`
	args := []interface{}{}

	if since != nil {
		query += " AND updated_at > ?"
		args = append(args, since.Format(time.RFC3339))
	}

	if !includeDeleted {
		query += " AND is_deleted = 0"
	}

	query += " ORDER BY updated_at DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []DocumentListItem
	for rows.Next() {
		var doc DocumentListItem
		var sourceURL sql.NullString
		var deletedAt sql.NullString

		err := rows.Scan(
			&doc.ID, &doc.Title, &sourceURL,
			&doc.CreatedAt, &doc.UpdatedAt, &doc.AccessedAt,
			&doc.ContentHash, &doc.SizeBytes, &doc.WordCount,
			&doc.IsDeleted, &deletedAt,
		)
		if err != nil {
			return nil, err
		}

		if sourceURL.Valid {
			doc.SourceURL = &sourceURL.String
		}
		if deletedAt.Valid {
			t, _ := time.Parse(time.RFC3339, deletedAt.String)
			doc.DeletedAt = &t
		}

		docs = append(docs, doc)
	}

	return docs, rows.Err()
}

// GetDocument returns a full document by ID
func (c *CloudDB) GetDocument(userID, docID string) (*Document, error) {
	db, err := c.getUserDB(userID)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	// Update accessed_at
	_, err = db.Exec("UPDATE documents SET accessed_at = CURRENT_TIMESTAMP WHERE id = ?", docID)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, title, content, source_url, created_at, updated_at, accessed_at,
		       content_hash, size_bytes, word_count, is_deleted, deleted_at
		FROM documents
		WHERE id = ?
	`

	var doc Document
	var sourceURL sql.NullString
	var deletedAt sql.NullString

	err = db.QueryRow(query, docID).Scan(
		&doc.ID, &doc.Title, &doc.Content, &sourceURL,
		&doc.CreatedAt, &doc.UpdatedAt, &doc.AccessedAt,
		&doc.ContentHash, &doc.SizeBytes, &doc.WordCount,
		&doc.IsDeleted, &deletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("document not found")
	}
	if err != nil {
		return nil, err
	}

	if sourceURL.Valid {
		doc.SourceURL = &sourceURL.String
	}
	if deletedAt.Valid {
		t, _ := time.Parse(time.RFC3339, deletedAt.String)
		doc.DeletedAt = &t
	}

	return &doc, nil
}

// CreateDocument creates a new document
func (c *CloudDB) CreateDocument(userID string, doc *Document) error {
	db, err := c.getUserDB(userID)
	if err != nil {
		return err
	}
	defer db.Close()

	// Calculate content hash
	doc.ContentHash = calculateHash(doc.Content)
	doc.SizeBytes = len(doc.Content)
	doc.WordCount = calculateWordCount(doc.Content)

	query := `
		INSERT INTO documents (
			id, title, content, source_url, content_hash, size_bytes, word_count
		) VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	_, err = db.Exec(query,
		doc.ID, doc.Title, doc.Content, doc.SourceURL,
		doc.ContentHash, doc.SizeBytes, doc.WordCount,
	)

	return err
}

// UpdateDocument updates an existing document
func (c *CloudDB) UpdateDocument(userID, docID string, title *string, content *string, baseHash *string) error {
	db, err := c.getUserDB(userID)
	if err != nil {
		return err
	}
	defer db.Close()

	// Check if baseHash matches (for conflict detection)
	if baseHash != nil {
		var currentHash string
		err := db.QueryRow("SELECT content_hash FROM documents WHERE id = ?", docID).Scan(&currentHash)
		if err == sql.ErrNoRows {
			return fmt.Errorf("document not found")
		}
		if err != nil {
			return err
		}

		if currentHash != *baseHash {
			return fmt.Errorf("conflict: base hash mismatch")
		}
	}

	// Build update query dynamically
	updates := []string{}
	args := []interface{}{}

	if title != nil {
		updates = append(updates, "title = ?")
		args = append(args, *title)
	}

	if content != nil {
		updates = append(updates, "content = ?", "content_hash = ?", "size_bytes = ?", "word_count = ?")
		contentHash := calculateHash(*content)
		sizeBytes := len(*content)
		wordCount := calculateWordCount(*content)
		args = append(args, *content, contentHash, sizeBytes, wordCount)
	}

	if len(updates) == 0 {
		return fmt.Errorf("nothing to update")
	}

	updates = append(updates, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, docID)

	query := fmt.Sprintf("UPDATE documents SET %s WHERE id = ?", strings.Join(updates, ", "))
	result, err := db.Exec(query, args...)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("document not found")
	}

	return nil
}

// DeleteDocument soft-deletes a document
func (c *CloudDB) DeleteDocument(userID, docID string) error {
	db, err := c.getUserDB(userID)
	if err != nil {
		return err
	}
	defer db.Close()

	query := `
		UPDATE documents 
		SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`

	result, err := db.Exec(query, docID)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("document not found")
	}

	return nil
}

// calculateHash returns SHA256 hash of content
func calculateHash(content string) string {
	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:])
}

// calculateWordCount returns approximate word count
func calculateWordCount(content string) int {
	words := strings.Fields(content)
	return len(words)
}
