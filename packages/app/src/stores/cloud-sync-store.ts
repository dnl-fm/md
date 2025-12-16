/**
 * Cloud Sync Store
 *
 * Manages state for cloud document synchronization using SolidJS signals.
 */
import { createSignal } from "solid-js";
import { cloudSyncClient, type CloudDocument, type ConflictError } from "../api/cloud-sync";

// ============================================================================
// Cloud Sync State
// ============================================================================

/** List of cloud documents (metadata only, no content) */
const [cloudDocuments, setCloudDocuments] = createSignal<CloudDocument[]>([]);

/** Currently selected cloud document for viewing/editing */
const [selectedCloudDoc, setSelectedCloudDoc] = createSignal<CloudDocument | null>(null);

/** Loading state for cloud operations */
const [isCloudLoading, setIsCloudLoading] = createSignal(false);

/** Error message from cloud operations */
const [cloudError, setCloudError] = createSignal<string | null>(null);

/** Last sync timestamp */
const [lastSyncToken, setLastSyncToken] = createSignal<string | null>(null);

/** Whether cloud documents modal is open */
const [isCloudModalOpen, setIsCloudModalOpen] = createSignal(false);

/** Conflict state for conflict resolution */
const [conflictState, setConflictState] = createSignal<{
  documentId: string;
  localContent: string;
  localHash: string;
  serverHash: string;
  serverUpdatedAt: string;
} | null>(null);

// ============================================================================
// Cloud Operations
// ============================================================================

/**
 * Fetch all cloud documents
 */
export async function fetchCloudDocuments(since?: string) {
  setIsCloudLoading(true);
  setCloudError(null);

  try {
    const result = await cloudSyncClient.listDocuments(since);
    setCloudDocuments(result.documents);
    setLastSyncToken(result.sync_token);
  } catch (error) {
    console.error("Failed to fetch cloud documents:", error);
    setCloudError(error instanceof Error ? error.message : "Failed to fetch documents");
  } finally {
    setIsCloudLoading(false);
  }
}

/**
 * Get full document content from cloud
 */
export async function getCloudDocument(id: string): Promise<CloudDocument | null> {
  setIsCloudLoading(true);
  setCloudError(null);

  try {
    const doc = await cloudSyncClient.getDocument(id);
    setSelectedCloudDoc(doc);
    return doc;
  } catch (error) {
    console.error("Failed to get cloud document:", error);
    setCloudError(error instanceof Error ? error.message : "Failed to get document");
    return null;
  } finally {
    setIsCloudLoading(false);
  }
}

/**
 * Save document to cloud
 */
export async function saveToCloud(title: string, content: string, sourceUrl?: string): Promise<CloudDocument | null> {
  setIsCloudLoading(true);
  setCloudError(null);

  try {
    const doc = await cloudSyncClient.createDocument({
      title,
      content,
      source_url: sourceUrl,
    });

    // Refresh document list
    await fetchCloudDocuments();

    return doc;
  } catch (error) {
    console.error("Failed to save to cloud:", error);
    setCloudError(error instanceof Error ? error.message : "Failed to save document");
    return null;
  } finally {
    setIsCloudLoading(false);
  }
}

/**
 * Update existing cloud document
 */
export async function updateCloudDocument(
  id: string,
  content: string,
  title?: string,
  baseHash?: string
): Promise<boolean> {
  setIsCloudLoading(true);
  setCloudError(null);

  try {
    const result = await cloudSyncClient.updateDocument(id, {
      title,
      content,
      base_hash: baseHash,
    });

    // Check for conflict
    if ("error" in result && result.error === "conflict") {
      const conflict = result as ConflictError;
      setConflictState({
        documentId: id,
        localContent: content,
        localHash: baseHash || "",
        serverHash: conflict.server_hash,
        serverUpdatedAt: conflict.server_updated_at,
      });
      return false;
    }

    // Success - refresh document list
    await fetchCloudDocuments();
    return true;
  } catch (error) {
    console.error("Failed to update cloud document:", error);
    setCloudError(error instanceof Error ? error.message : "Failed to update document");
    return false;
  } finally {
    setIsCloudLoading(false);
  }
}

/**
 * Delete document from cloud (soft delete)
 */
export async function deleteCloudDocument(id: string): Promise<boolean> {
  setIsCloudLoading(true);
  setCloudError(null);

  try {
    await cloudSyncClient.deleteDocument(id);

    // Refresh document list
    await fetchCloudDocuments();

    return true;
  } catch (error) {
    console.error("Failed to delete cloud document:", error);
    setCloudError(error instanceof Error ? error.message : "Failed to delete document");
    return false;
  } finally {
    setIsCloudLoading(false);
  }
}

/**
 * Resolve conflict by choosing local or server version
 */
export async function resolveConflict(useLocal: boolean): Promise<boolean> {
  const conflict = conflictState();
  if (!conflict) return false;

  if (useLocal) {
    // Force update with local content (no base_hash check)
    return await updateCloudDocument(conflict.documentId, conflict.localContent);
  } else {
    // Fetch server version and use it
    const serverDoc = await getCloudDocument(conflict.documentId);
    if (serverDoc && serverDoc.content) {
      // This would typically update the local editor with server content
      // For now, just clear the conflict state
      setConflictState(null);
      return true;
    }
    return false;
  }
}

/**
 * Clear conflict state
 */
export function clearConflict() {
  setConflictState(null);
}

/**
 * Toggle cloud documents modal
 */
export function toggleCloudModal() {
  setIsCloudModalOpen(!isCloudModalOpen());
}

/**
 * Open cloud documents modal
 */
export function openCloudModal() {
  setIsCloudModalOpen(true);
  // Fetch documents when opening
  fetchCloudDocuments();
}

/**
 * Close cloud documents modal
 */
export function closeCloudModal() {
  setIsCloudModalOpen(false);
}

// ============================================================================
// Exports
// ============================================================================

// Export state signals
export {
  cloudDocuments,
  selectedCloudDoc,
  isCloudLoading,
  cloudError,
  lastSyncToken,
  isCloudModalOpen,
  conflictState,
  setCloudDocuments,
  setSelectedCloudDoc,
  setIsCloudLoading,
  setCloudError,
};

// Export setter with alias
export { setIsCloudModalOpen as setCloudModalOpen };
