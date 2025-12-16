/**
 * Cloud Sync API client
 *
 * Communicates with api.getmd.dev for document storage and synchronization.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "https://api.getmd.dev";
const DEV_USER_ID = "dev-user-001";

export interface CloudDocument {
  id: string;
  title: string;
  content?: string; // Only present in get/create responses
  source_url?: string;
  created_at: string;
  updated_at: string;
  accessed_at: string;
  content_hash: string;
  size_bytes: number;
  word_count: number;
  is_deleted: boolean;
  deleted_at?: string;
}

export interface CloudDocumentList {
  documents: CloudDocument[];
  sync_token: string;
}

export interface CreateDocumentRequest {
  title: string;
  content: string;
  source_url?: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  base_hash?: string;
}

export interface UpdateDocumentResponse {
  id: string;
  updated_at: string;
  content_hash: string;
}

export interface ConflictError {
  error: "conflict";
  server_hash: string;
  server_updated_at: string;
}

class CloudSyncClient {
  private getHeaders(): HeadersInit {
    return {
      "X-Dev-User": DEV_USER_ID,
      "Content-Type": "application/json",
    };
  }

  /**
   * List all documents
   */
  async listDocuments(since?: string, includeDeleted = false): Promise<CloudDocumentList> {
    const params = new URLSearchParams();
    if (since) params.append("since", since);
    if (includeDeleted) params.append("include_deleted", "true");

    const url = `${API_BASE}/v1/cloud/documents?${params}`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to list documents: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get a specific document with full content
   */
  async getDocument(id: string): Promise<CloudDocument> {
    const url = `${API_BASE}/v1/cloud/documents/${id}`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (response.status === 404) {
      throw new Error("Document not found");
    }

    if (!response.ok) {
      throw new Error(`Failed to get document: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new document
   */
  async createDocument(data: CreateDocumentRequest): Promise<CloudDocument> {
    const url = `${API_BASE}/v1/cloud/documents`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create document");
    }

    return response.json();
  }

  /**
   * Update an existing document
   */
  async updateDocument(
    id: string,
    data: UpdateDocumentRequest
  ): Promise<UpdateDocumentResponse | ConflictError> {
    const url = `${API_BASE}/v1/cloud/documents/${id}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (response.status === 409) {
      // Conflict - return conflict info
      return response.json();
    }

    if (response.status === 404) {
      throw new Error("Document not found");
    }

    if (!response.ok) {
      throw new Error(`Failed to update document: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete a document (soft delete)
   */
  async deleteDocument(id: string): Promise<void> {
    const url = `${API_BASE}/v1/cloud/documents/${id}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getHeaders(),
    });

    if (response.status === 404) {
      throw new Error("Document not found");
    }

    if (!response.ok) {
      throw new Error(`Failed to delete document: ${response.statusText}`);
    }
  }
}

export const cloudSyncClient = new CloudSyncClient();
