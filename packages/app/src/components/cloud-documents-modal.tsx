/**
 * Cloud Documents Modal
 *
 * Displays list of cloud-synced documents and allows opening them.
 */
import { Show, For } from "solid-js";
import {
  cloudDocuments,
  isCloudLoading,
  cloudError,
  isCloudModalOpen,
  closeCloudModal,
  getCloudDocument,
  deleteCloudDocument,
} from "../stores/cloud-sync-store";
import { setContent, setCurrentFile } from "../stores/app-store";
import { confirm } from "./confirm-dialog";
import "./cloud-documents-modal.css";

export function CloudDocumentsModal() {
  const handleOpenDocument = async (id: string) => {
    const doc = await getCloudDocument(id);
    if (doc && doc.content) {
      setContent(doc.content);
      setCurrentFile(null); // Mark as cloud document (not local file)
      closeCloudModal();
    }
  };

  const handleDeleteDocument = async (id: string, title: string) => {
    const confirmed = await confirm(
      `Delete "${title}" from cloud?`,
      "This will soft-delete the document. It can be recovered from the server."
    );

    if (confirmed) {
      await deleteCloudDocument(id);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Show when={isCloudModalOpen()}>
      <div class="modal-backdrop" onClick={closeCloudModal}>
        <div class="modal cloud-modal" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>☁️ Cloud Documents</h2>
            <button class="close-btn" onClick={closeCloudModal}>
              ×
            </button>
          </div>

          <div class="modal-body">
            <Show when={cloudError()}>
              <div class="error-message">{cloudError()}</div>
            </Show>

            <Show when={isCloudLoading()}>
              <div class="loading-message">Loading documents...</div>
            </Show>

            <Show when={!isCloudLoading() && cloudDocuments().length === 0}>
              <div class="empty-message">
                <p>No cloud documents yet.</p>
                <p class="hint">Click "Save to Cloud" to sync your documents.</p>
              </div>
            </Show>

            <Show when={!isCloudLoading() && cloudDocuments().length > 0}>
              <div class="documents-list">
                <For each={cloudDocuments()}>
                  {(doc) => (
                    <div class="document-item">
                      <div class="document-info" onClick={() => handleOpenDocument(doc.id)}>
                        <h3 class="document-title">{doc.title}</h3>
                        <div class="document-meta">
                          <span class="meta-item">
                            {doc.word_count} words
                          </span>
                          <span class="meta-item">
                            {formatSize(doc.size_bytes)}
                          </span>
                          <span class="meta-item">
                            Updated {formatDate(doc.updated_at)}
                          </span>
                        </div>
                        <Show when={doc.source_url}>
                          <div class="document-source">{doc.source_url}</div>
                        </Show>
                      </div>
                      <div class="document-actions">
                        <button
                          class="action-btn delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id, doc.title);
                          }}
                          title="Delete from cloud"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" onClick={closeCloudModal}>
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
