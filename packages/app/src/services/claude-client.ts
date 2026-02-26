/**
 * Claude API client using Tauri backend proxy.
 * 
 * All API calls go through Rust to avoid CORS issues.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AiMessage, AiModel } from "../stores/ai-chat-store";

// ============================================================================
// Types
// ============================================================================

export interface StreamCallbacks {
  onStart?: () => void;
  onText?: (text: string, fullText: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface DocumentContext {
  content: string;
  filename?: string;
  otherTabs?: { filename: string; content: string }[];
}

interface ChatStreamEvent {
  event_type: "start" | "delta" | "done" | "error";
  content?: string;
  error?: string;
}

// ============================================================================
// System Prompt
// ============================================================================

function buildSystemPrompt(context: DocumentContext): string {
  const parts: string[] = [
    "You are an AI assistant integrated into MD, a markdown viewer and editor application.",
    "",
    "## Your Role",
    "Help users understand, improve, and work with their markdown documents.",
    "",
    "## Current Document",
    context.filename ? `Filename: ${context.filename}` : "Untitled document",
    "",
    "```markdown",
    context.content,
    "```",
    "",
    "## Capabilities",
    "- Answer questions about the document content",
    "- Suggest improvements to writing, structure, or formatting",
    "- Explain sections or concepts in the document",
    "- Help with markdown syntax",
    "- The app supports mermaid diagrams (```mermaid) and ASCII diagrams (```ascii)",
    "",
    "## Constraints", 
    "- You cannot execute code or access the file system",
    "- You can only read the document, not modify it directly",
    "- Provide suggestions as markdown code blocks when proposing edits",
    "",
    "## Commands",
    "Users can use these commands:",
    "- /clear - Clear chat history (handled by the app)",
    "- /tabs - List other open documents (future feature)",
    "",
    "Be concise and helpful. Format responses in markdown when appropriate.",
  ];
  
  return parts.join("\n");
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Validate an API token via Tauri backend
 */
export async function validateToken(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    await invoke<boolean>("validate_claude_token", { token });
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    // Parse common error cases
    if (message.includes("401") || message.includes("authentication") || message.includes("Unauthorized")) {
      return { valid: false, error: "Invalid API key or token" };
    }
    if (message.includes("403") || message.includes("permission")) {
      return { valid: false, error: "Token lacks required permissions" };
    }
    if (message.includes("Network")) {
      return { valid: false, error: "Network error. Check your connection." };
    }
    
    return { valid: false, error: message };
  }
}

/**
 * Convert our message format to API format
 */
function toApiMessages(messages: AiMessage[]): { role: string; content: string }[] {
  return messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({
      role: m.role,
      content: m.content,
    }));
}

/**
 * Stream a chat response via Tauri backend
 */
export async function streamChat(
  token: string,
  model: AiModel,
  messages: AiMessage[],
  context: DocumentContext,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const systemPrompt = buildSystemPrompt(context);
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const eventName = `claude-stream-${requestId}`;
  
  let fullText = "";
  let unlisten: UnlistenFn | null = null;
  
  try {
    // Set up event listener for streaming
    unlisten = await listen<ChatStreamEvent>(eventName, (event) => {
      if (signal?.aborted) return;
      
      const payload = event.payload;
      
      switch (payload.event_type) {
        case "start":
          callbacks.onStart?.();
          break;
        case "delta":
          if (payload.content) {
            fullText += payload.content;
            callbacks.onText?.(payload.content, fullText);
          }
          break;
        case "done":
          callbacks.onDone?.(fullText);
          break;
        case "error":
          callbacks.onError?.(new Error(payload.error || "Unknown error"));
          break;
      }
    });
    
    // Start the stream
    await invoke("stream_claude_chat", {
      request: {
        token,
        model,
        messages: toApiMessages(messages),
        system_prompt: systemPrompt,
      },
      requestId,
    });
    
  } catch (error) {
    if (!signal?.aborted) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  } finally {
    if (unlisten) {
      unlisten();
    }
  }
}
