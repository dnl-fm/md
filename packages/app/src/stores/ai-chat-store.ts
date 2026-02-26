/**
 * AI Chat state store using SolidJS signals.
 * 
 * Manages:
 * - Chat panel visibility
 * - API token (cached in localStorage)
 * - Chat messages
 * - Model selection
 * - Loading state
 */
import { createSignal } from "solid-js";

// ============================================================================
// Types
// ============================================================================

export interface AiMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export type AiModel = "claude-haiku-4-5" | "claude-sonnet-4-5" | "claude-opus-4-5";

export const AI_MODELS: { id: AiModel; name: string; shortName: string }[] = [
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", shortName: "haiku-4.5" },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", shortName: "sonnet-4.5" },
  { id: "claude-opus-4-5", name: "Claude Opus 4.5", shortName: "opus-4.5" },
];

// ============================================================================
// Constants
// ============================================================================

const TOKEN_STORAGE_KEY = "md-ai-token";
const MODEL_STORAGE_KEY = "md-ai-model";
const DEFAULT_WIDTH_PERCENT = 25;

// ============================================================================
// State
// ============================================================================

/** Whether AI chat panel is visible */
const [showAiChat, setShowAiChat] = createSignal(false);

/** API token (null if not set) */
const [aiToken, setAiTokenInternal] = createSignal<string | null>(
  localStorage.getItem(TOKEN_STORAGE_KEY)
);

/** Whether token has been validated */
const [aiTokenValid, setAiTokenValid] = createSignal(false);

/** Whether we're currently validating the token */
const [aiTokenValidating, setAiTokenValidating] = createSignal(false);

/** Token validation error message */
const [aiTokenError, setAiTokenError] = createSignal<string | null>(null);

/** Chat messages */
const [aiMessages, setAiMessages] = createSignal<AiMessage[]>([]);

/** Whether a response is being generated */
const [aiLoading, setAiLoading] = createSignal(false);

/** Get valid stored model or default */
function getStoredModel(): AiModel {
  const stored = localStorage.getItem(MODEL_STORAGE_KEY);
  // Validate stored model exists in AI_MODELS
  if (stored && AI_MODELS.some(m => m.id === stored)) {
    return stored as AiModel;
  }
  // Clear invalid stored value
  if (stored) {
    localStorage.removeItem(MODEL_STORAGE_KEY);
  }
  return "claude-haiku-4-5";
}

/** Selected model */
const [aiModel, setAiModelInternal] = createSignal<AiModel>(getStoredModel());

/** AI chat panel width as percentage */
const [aiChatWidth, setAiChatWidth] = createSignal(DEFAULT_WIDTH_PERCENT);

/** Whether user is resizing the AI chat panel */
const [aiChatResizing, setAiChatResizing] = createSignal(false);

/** Current abort controller for canceling requests */
let currentAbortController: AbortController | null = null;

// ============================================================================
// Actions
// ============================================================================

/**
 * Set and persist the API token
 */
function setAiToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  setAiTokenInternal(token);
  setAiTokenValid(false);
  setAiTokenError(null);
}

/**
 * Set and persist the model selection
 */
function setAiModel(model: AiModel) {
  localStorage.setItem(MODEL_STORAGE_KEY, model);
  setAiModelInternal(model);
}

/**
 * Add a user message
 */
function addUserMessage(content: string): AiMessage {
  const message: AiMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content,
    timestamp: Date.now(),
  };
  setAiMessages([...aiMessages(), message]);
  return message;
}

/**
 * Add an assistant message (optionally streaming)
 */
function addAssistantMessage(content: string = "", isStreaming: boolean = false): AiMessage {
  const message: AiMessage = {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    content,
    timestamp: Date.now(),
    isStreaming,
  };
  setAiMessages([...aiMessages(), message]);
  return message;
}

/**
 * Update the last assistant message (for streaming)
 */
function updateLastAssistantMessage(content: string, isStreaming: boolean = true) {
  setAiMessages(messages => {
    const updated = [...messages];
    // Find last assistant message index
    let lastIdx = -1;
    for (let i = updated.length - 1; i >= 0; i--) {
      if (updated[i].role === "assistant") {
        lastIdx = i;
        break;
      }
    }
    if (lastIdx !== -1) {
      updated[lastIdx] = {
        ...updated[lastIdx],
        content,
        isStreaming,
      };
    }
    return updated;
  });
}

/**
 * Clear all messages (for /clear command)
 */
function clearMessages() {
  setAiMessages([]);
}

/**
 * Get abort signal for current request
 */
function getAbortSignal(): AbortSignal {
  currentAbortController = new AbortController();
  return currentAbortController.signal;
}

/**
 * Abort current request
 */
function abortCurrentRequest() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

/**
 * Toggle AI chat panel visibility
 */
function toggleAiChat() {
  setShowAiChat(!showAiChat());
}

/**
 * Clear token and validation state (logout)
 */
function clearAiToken() {
  setAiToken(null);
  setAiTokenValid(false);
  setAiTokenError(null);
  clearMessages();
}

// ============================================================================
// Exports
// ============================================================================

export {
  // State
  showAiChat,
  setShowAiChat,
  aiToken,
  setAiToken,
  aiTokenValid,
  setAiTokenValid,
  aiTokenValidating,
  setAiTokenValidating,
  aiTokenError,
  setAiTokenError,
  aiMessages,
  setAiMessages,
  aiLoading,
  setAiLoading,
  aiModel,
  setAiModel,
  aiChatWidth,
  setAiChatWidth,
  aiChatResizing,
  setAiChatResizing,
  DEFAULT_WIDTH_PERCENT,
  // Actions
  addUserMessage,
  addAssistantMessage,
  updateLastAssistantMessage,
  clearMessages,
  getAbortSignal,
  abortCurrentRequest,
  toggleAiChat,
  clearAiToken,
};
