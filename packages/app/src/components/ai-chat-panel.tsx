/**
 * AI Chat Panel - Side panel for chatting with Claude about the document.
 * 
 * Shows token setup if no valid token, otherwise shows chat interface.
 * Sits alongside main content in a two-column layout.
 * 
 * Commands:
 * - /clear - Reset conversation
 * - /summarise - Summarise the document
 * - /model - Select AI model (haiku-4.5, sonnet-4.5, opus-4.5)
 * - /export - Export chat as markdown in new tab
 */
import { Show, For, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import MarkdownIt from "markdown-it";
import { escapeHtml } from "../utils";

// Mermaid loaded via script tag in index.html
declare const mermaid: typeof import("mermaid").default;
import {
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
  aiLoading,
  setAiLoading,
  aiModel,
  setAiModel,
  aiChatWidth,
  setAiChatWidth,
  setAiChatResizing,
  AI_MODELS,
  addUserMessage,
  addAssistantMessage,
  updateLastAssistantMessage,
  clearMessages,
  getAbortSignal,
  abortCurrentRequest,
  clearAiToken,
  type AiModel,
} from "../stores/ai-chat-store";
import { validateToken, streamChat } from "../services/claude-client";
import { content, currentFile, currentDraftId, getDraft, createDraft, updateDraft, setCurrentDraftId, setContent, setCurrentFile } from "../stores/app-store";
import { getFilename } from "../utils";
import "../styles/ai-chat.css";

// ============================================================================
// Command Definitions
// ============================================================================

interface Command {
  name: string;
  description: string;
  hasSubmenu?: boolean;
  action?: () => void | Promise<void>;
  submenuItems?: { id: string; label: string; action: () => void }[];
}

const SUMMARISE_PROMPT = `Please provide a comprehensive summary of this document. Include:

1. **Main Purpose**: What is this document about? (1-2 sentences)
2. **Key Points**: The most important information, organized by topic
3. **Structure Overview**: How the document is organized (sections, flow)
4. **Notable Details**: Any critical details, warnings, or action items
5. **Audience**: Who this document appears to be written for

Keep the summary concise but complete. Use bullet points for clarity. If the document contains code, technical specs, or diagrams, briefly note what they cover without reproducing them.`;

// Markdown renderer for assistant messages
const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

// Store mermaid code by message ID to avoid data attribute issues
const mermaidCodeMap = new Map<string, string>();

/** Clear mermaid cache (call when chat is cleared) */
export function clearMermaidCache() {
  mermaidCodeMap.clear();
}

// Custom fence renderer for mermaid diagrams
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const code = token.content;
  const lang = (token.info || "").trim().split(/\s+/)[0];
  
  if (lang === "mermaid") {
    // Use content hash as stable ID (handle unicode safely)
    const hash = Array.from(new TextEncoder().encode(code))
      .slice(0, 16)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const id = `ai-mermaid-${hash}`;
    mermaidCodeMap.set(id, code);
    return `<div class="mermaid-wrapper"><div class="mermaid-diagram mermaid-loading" id="${id}"><div class="mermaid-spinner"></div></div></div>`;
  }
  
  // Default code block rendering
  const escaped = escapeHtml(code);
  if (lang) {
    return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
  }
  return `<pre><code>${escaped}</code></pre>`;
};

interface AiChatPanelProps {
  onSaveWidth: (width: number) => void;
}

// ============================================================================
// Token Setup Component
// ============================================================================

function TokenSetup() {
  const [inputToken, setInputToken] = createSignal("");
  
  // Validate stored token on mount
  onMount(async () => {
    const storedToken = aiToken();
    if (storedToken && !aiTokenValid()) {
      setAiTokenValidating(true);
      const result = await validateToken(storedToken);
      setAiTokenValidating(false);
      
      if (result.valid) {
        setAiTokenValid(true);
      } else {
        // Token expired/invalid, clear it
        setAiToken(null);
      }
    }
  });
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    const token = inputToken().trim();
    if (!token) return;
    
    setAiTokenValidating(true);
    setAiTokenError(null);
    
    const result = await validateToken(token);
    
    setAiTokenValidating(false);
    
    if (result.valid) {
      setAiToken(token);
      setAiTokenValid(true);
    } else {
      setAiTokenError(result.error || "Invalid token");
    }
  }
  
  // Show loading if we're validating a stored token
  const isValidatingStored = () => aiTokenValidating() && aiToken() && !inputToken();
  
  return (
    <div class="ai-token-setup">
      <Show when={isValidatingStored()} fallback={
        <>
          <div class="ai-token-icon">🔑</div>
          <h3>Connect to Claude</h3>
          <p>Enter your Anthropic API key or OAuth token to start chatting.</p>
          
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              class="ai-token-input"
              placeholder="sk-ant-api03-... or sk-ant-oat..."
              value={inputToken()}
              onInput={(e) => setInputToken(e.currentTarget.value)}
              disabled={aiTokenValidating()}
              autofocus
            />
            
            <Show when={aiTokenError()}>
              <div class="ai-token-error">{aiTokenError()}</div>
            </Show>
            
            <button
              type="submit"
              class="btn ai-token-submit"
              disabled={!inputToken().trim() || aiTokenValidating()}
            >
              {aiTokenValidating() ? "Validating..." : "Connect"}
            </button>
          </form>
          
          <p class="ai-token-help">
            Get an API key from{" "}
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener">
              console.anthropic.com
            </a>
          </p>
        </>
      }>
        <div class="ai-token-icon">⏳</div>
        <h3>Connecting...</h3>
        <p>Validating your saved token</p>
      </Show>
    </div>
  );
}

// ============================================================================
// Message Component
// ============================================================================

interface MessageProps {
  message: typeof aiMessages extends () => (infer T)[] ? T : never;
}

function Message(props: MessageProps) {
  let containerRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;
  let lastRenderedContent = "";
  let hasMermaidRendered = false;
  
  // Update markdown content when it changes
  createEffect(() => {
    const content = props.message.content;
    const isStreaming = props.message.isStreaming;
    
    if (!contentRef || !content) return;
    
    // Skip update if mermaid is rendered and content hasn't changed
    if (hasMermaidRendered && content === lastRenderedContent) return;
    
    // During streaming, always update. After streaming, only update if content changed
    if (isStreaming || content !== lastRenderedContent) {
      contentRef.innerHTML = md.render(content);
      lastRenderedContent = content;
      
      // Reset mermaid flag during streaming
      if (isStreaming) {
        hasMermaidRendered = false;
      }
    }
  });

  // Process mermaid diagrams after render
  createEffect(() => {
    const msgContent = props.message.content;
    const isStreaming = props.message.isStreaming;
    
    // Only process when we have content and not streaming
    if (!msgContent || isStreaming || !containerRef) return;
    
    // Small delay to ensure DOM is updated
    setTimeout(() => {
      // Find all mermaid placeholders
      const diagrams = containerRef.querySelectorAll('.mermaid-diagram');
      
      diagrams.forEach(async (el) => {
        if (el.querySelector('svg')) return; // Already rendered
        
        const code = mermaidCodeMap.get(el.id);
        if (!code) return;
        
        try {
          const { svg } = await mermaid.render(el.id + '-svg', code);
          el.innerHTML = svg;
          el.classList.remove('mermaid-loading');
          hasMermaidRendered = true;
        } catch (err) {
          console.error('Mermaid render error:', err);
          el.innerHTML = `<pre class="mermaid-error">Diagram error: ${err}</pre>`;
          el.classList.remove('mermaid-loading');
        }
      });
    }, 100);
  });

  return (
    <div class={`ai-message ai-message-${props.message.role}`} ref={containerRef}>
      <Show when={props.message.isStreaming && !props.message.content}>
        <span class="ai-typing-indicator">
          <span></span><span></span><span></span>
        </span>
      </Show>
      <Show when={props.message.content}>
        <Show when={props.message.role === "assistant"} fallback={
          <div class="ai-message-user-text">{props.message.content}</div>
        }>
          <div ref={contentRef} class="ai-message-assistant markdown-body" />
        </Show>
      </Show>
    </div>
  );
}

// ============================================================================
// Chat View Component
// ============================================================================

function ChatView() {
  const [input, setInput] = createSignal("");
  const [showCommandMenu, setShowCommandMenu] = createSignal(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = createSignal(0);
  const [showModelSubmenu, setShowModelSubmenu] = createSignal(false);
  const [selectedModelIndex, setSelectedModelIndex] = createSignal(0);
  let messagesEndRef: HTMLDivElement | undefined;
  let inputRef: HTMLTextAreaElement | undefined;
  
  // Command definitions (needs to be inside ChatView for access to sendMessage)
  const commands: Command[] = [
    { name: "clear", description: "Reset conversation" },
    { name: "summarise", description: "Summarise the document" },
    { name: "model", description: "Select AI model", hasSubmenu: true },
    { name: "export", description: "Export chat as markdown" },
  ];
  
  // Filter commands based on input
  const filteredCommands = () => {
    const text = input().toLowerCase();
    if (!text.startsWith("/")) return [];
    const query = text.slice(1);
    return commands.filter(cmd => cmd.name.startsWith(query));
  };
  
  // Auto-scroll to bottom when messages change
  createEffect(() => {
    const messages = aiMessages();
    if (messages.length > 0 && messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: "smooth" });
    }
  });
  
  // Show/hide command menu based on input
  createEffect(() => {
    const text = input();
    if (text.startsWith("/") && !showModelSubmenu()) {
      const filtered = filteredCommands();
      if (filtered.length > 0) {
        setShowCommandMenu(true);
        // Reset selection if out of bounds
        if (selectedCommandIndex() >= filtered.length) {
          setSelectedCommandIndex(0);
        }
      } else {
        setShowCommandMenu(false);
      }
    } else if (!showModelSubmenu()) {
      setShowCommandMenu(false);
    }
  });
  
  // Focus input on mount
  onMount(() => {
    inputRef?.focus();
  });
  
  function getDocumentContext() {
    const file = currentFile();
    const draftId = currentDraftId();
    let filename: string | undefined;
    
    if (file) {
      filename = getFilename(file);
    } else if (draftId) {
      const draft = getDraft(draftId);
      filename = draft?.sourceTitle || `Draft ${draftId}`;
    }
    
    return {
      content: content(),
      filename,
    };
  }
  
  async function sendMessage(text: string) {
    addUserMessage(text);
    setAiLoading(true);
    addAssistantMessage("", true);
    
    const token = aiToken();
    if (!token) return;
    
    await streamChat(
      token,
      aiModel(),
      aiMessages(),
      getDocumentContext(),
      {
        onText: (_delta, fullText) => {
          updateLastAssistantMessage(fullText, true);
        },
        onDone: (fullText) => {
          updateLastAssistantMessage(fullText, false);
          setAiLoading(false);
        },
        onError: (error) => {
          updateLastAssistantMessage(`Error: ${error.message}`, false);
          setAiLoading(false);
        },
      },
      getAbortSignal()
    );
  }
  
  function executeCommand(commandName: string) {
    switch (commandName) {
      case "clear":
        clearMessages();
        mermaidCodeMap.clear();
        break;
      case "summarise":
        sendMessage(SUMMARISE_PROMPT);
        break;
      case "model":
        setShowCommandMenu(false);
        setShowModelSubmenu(true);
        setSelectedModelIndex(AI_MODELS.findIndex(m => m.id === aiModel()));
        return; // Don't clear input yet
      case "export":
        exportChatAsMarkdown();
        break;
    }
    setInput("");
    setShowCommandMenu(false);
  }
  
  function exportChatAsMarkdown() {
    const messages = aiMessages();
    if (messages.length === 0) {
      addAssistantMessage("Nothing to export. Start a conversation first.");
      return;
    }
    
    // Build markdown content
    const lines: string[] = [
      "# AI Chat Export",
      "",
      `*Exported on ${new Date().toLocaleString()}*`,
      "",
      "---",
      "",
    ];
    
    for (const msg of messages) {
      if (msg.role === "user") {
        lines.push("## 👤 You", "", msg.content, "", "---", "");
      } else if (msg.role === "assistant") {
        lines.push("## 🤖 Assistant", "", msg.content, "", "---", "");
      }
    }
    
    const markdownContent = lines.join("\n");
    
    // Create new draft and switch to it
    const draftId = createDraft({ url: "", title: "AI Chat Export" });
    updateDraft(draftId, markdownContent);
    setCurrentFile(null);
    setCurrentDraftId(draftId);
    setContent(markdownContent);
    
    addAssistantMessage("Chat exported to a new tab.");
  }
  
  function selectModel(modelId: AiModel) {
    setAiModel(modelId);
    const model = AI_MODELS.find(m => m.id === modelId);
    addAssistantMessage(`Model switched to **${model?.name || modelId}**`);
    setInput("");
    setShowModelSubmenu(false);
  }
  
  async function handleSubmit(e?: Event) {
    e?.preventDefault();
    const text = input().trim();
    if (!text || aiLoading()) return;
    
    // If command menu is showing, execute selected command
    if (showCommandMenu() && filteredCommands().length > 0) {
      const selected = filteredCommands()[selectedCommandIndex()];
      if (selected) {
        executeCommand(selected.name);
        return;
      }
    }
    
    // If model submenu is showing, select the model
    if (showModelSubmenu()) {
      const selected = AI_MODELS[selectedModelIndex()];
      if (selected) {
        selectModel(selected.id);
        return;
      }
    }
    
    // Handle direct commands that match exactly
    if (text.startsWith("/")) {
      const command = text.toLowerCase().slice(1);
      const exactMatch = commands.find(cmd => cmd.name === command);
      if (exactMatch) {
        executeCommand(exactMatch.name);
        return;
      }
    }
    
    // Regular message
    setInput("");
    await sendMessage(text);
  }
  
  function handleKeyDown(e: KeyboardEvent) {
    // Handle command menu navigation
    if (showCommandMenu()) {
      const filtered = filteredCommands();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex(i => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const selected = filtered[selectedCommandIndex()];
        if (selected) {
          setInput(`/${selected.name}`);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowCommandMenu(false);
        setInput("");
        return;
      }
    }
    
    // Handle model submenu navigation
    if (showModelSubmenu()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedModelIndex(i => Math.min(i + 1, AI_MODELS.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedModelIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowModelSubmenu(false);
        setInput("");
        return;
      }
    }
    
    // Enter to send/select, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }
  
  function handleStop() {
    abortCurrentRequest();
    setAiLoading(false);
  }
  
  return (
    <div class="ai-chat-view">
      {/* Messages */}
      <div class="ai-messages">
        <Show when={aiMessages().length === 0}>
          <div class="ai-empty-state">
            <div class="ai-empty-icon">💬</div>
            <p>Ask me anything about your document!</p>
            <p class="ai-empty-hint">
              Type <code>/</code> for commands
            </p>
          </div>
        </Show>
        
        <For each={aiMessages()}>
          {(message) => <Message message={message} />}
        </For>
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input with command menu */}
      <div class="ai-input-container">
        {/* Command menu */}
        <Show when={showCommandMenu() && filteredCommands().length > 0}>
          <div class="ai-command-menu">
            <For each={filteredCommands()}>
              {(cmd, index) => (
                <div
                  class={`ai-command-item ${index() === selectedCommandIndex() ? "selected" : ""}`}
                  onClick={() => executeCommand(cmd.name)}
                  onMouseEnter={() => setSelectedCommandIndex(index())}
                >
                  <span class="ai-command-name">/{cmd.name}</span>
                  <span class="ai-command-desc">{cmd.description}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
        
        {/* Model submenu */}
        <Show when={showModelSubmenu()}>
          <div class="ai-command-menu">
            <div class="ai-command-menu-header">Select Model</div>
            <For each={AI_MODELS}>
              {(model, index) => (
                <div
                  class={`ai-command-item ${index() === selectedModelIndex() ? "selected" : ""} ${model.id === aiModel() ? "current" : ""}`}
                  onClick={() => selectModel(model.id)}
                  onMouseEnter={() => setSelectedModelIndex(index())}
                >
                  <span class="ai-command-name">{model.shortName}</span>
                  <span class="ai-command-desc">{model.name}</span>
                  <Show when={model.id === aiModel()}>
                    <span class="ai-command-current">✓</span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
        
        <form class="ai-input-form" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            class="ai-input"
            placeholder="Ask about your document..."
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={aiLoading()}
            rows={1}
          />
          
          <Show when={aiLoading()} fallback={
            <button
              type="submit"
              class="btn ai-send-btn"
              disabled={!input().trim()}
              title="Send (Enter)"
            >
              ↑
            </button>
          }>
            <button
              type="button"
              class="btn ai-stop-btn"
              onClick={handleStop}
              title="Stop generating"
            >
              ⬛
            </button>
          </Show>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

export function AiChatPanel(props: AiChatPanelProps) {
  let panelRef: HTMLDivElement | undefined;
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  
  function handleResizeStart(e: MouseEvent) {
    e.preventDefault();
    resizeStartX = e.clientX;
    const container = panelRef?.parentElement;
    if (container) {
      resizeStartWidth = (aiChatWidth() / 100) * container.clientWidth;
    }
    setAiChatResizing(true);
    
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
  }
  
  function handleResizeMove(e: MouseEvent) {
    const container = panelRef?.parentElement;
    if (!container) return;
    
    const deltaX = resizeStartX - e.clientX;
    const newWidth = resizeStartWidth + deltaX;
    const containerWidth = container.clientWidth;
    
    // Clamp between 15% and 60%
    const minWidth = containerWidth * 0.15;
    const maxWidth = containerWidth * 0.60;
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    
    const newPercent = (clampedWidth / containerWidth) * 100;
    setAiChatWidth(newPercent);
  }
  
  function handleResizeEnd() {
    setAiChatResizing(false);
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    
    // Save width to config
    props.onSaveWidth(aiChatWidth());
  }
  
  function handleResizeDoubleClick() {
    // Auto-fit: measure content and set width accordingly
    if (panelRef) {
      const messagesContainer = panelRef.querySelector(".ai-messages");
      if (messagesContainer) {
        // Get the natural content width
        const container = panelRef.parentElement;
        if (container) {
          // Set to a reasonable auto-fit width (40% is good for reading)
          const autoWidth = 35;
          setAiChatWidth(autoWidth);
          props.onSaveWidth(autoWidth);
        }
      }
    }
  }
  
  function handleLogout() {
    clearAiToken();
  }
  
  // Cleanup on unmount
  onCleanup(() => {
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  });
  
  return (
    <Show when={showAiChat()}>
      <div 
        ref={panelRef}
        class="ai-chat-panel"
        style={{ flex: `0 0 ${aiChatWidth()}%` }}
      >
        {/* Resize handle */}
        <div 
          class="ai-resize-handle"
          onMouseDown={handleResizeStart}
          onDblClick={handleResizeDoubleClick}
          title="Drag to resize, double-click to auto-fit"
        />
        
        {/* Header */}
        <div class="ai-chat-header">
          <div class="ai-chat-title">
            <span class="ai-chat-icon">✨</span>
            <span>AI Chat</span>
          </div>
          
          <div class="ai-chat-actions">
            <Show when={aiTokenValid()}>
              <button
                class="btn btn-small ai-logout-btn"
                onClick={handleLogout}
                title="Disconnect from Claude API"
              >
                Disconnect
              </button>
            </Show>
            
            <button
              class="ai-close-btn"
              onClick={() => setShowAiChat(false)}
              title="Close (Ctrl+A)"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Body */}
        <div class="ai-chat-body">
          <Show when={aiTokenValid()} fallback={<TokenSetup />}>
            <ChatView />
          </Show>
        </div>
      </div>
    </Show>
  );
}
