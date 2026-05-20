import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, Send, Bot, User, Sparkles, Trash2, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../../types";
import { useMindMapStore } from "../../stores/mindmapStore";
import { chatWithAI, type AIResponse } from "../../services/aiService";
import { skillRegistry } from "../../services/skills";
import { memoryService } from "../../services/memoryService";
import { findNodePathByIndex, decodeHTMLEntities, flattenNodes } from "../../utils/mindmapHelpers";
import { useTranslation } from "../../i18n";
import "./ChatPanel.css";

export default function ChatPanel() {
  const { t, lang } = useTranslation();
  const {
    chatMessages,
    addChatMessage,
    toggleChat,
    clearChat,
    selectedNodeId,
    currentProject,
    appendChildren,
    updateNode,
    deleteNodes,
  } = useMindMapStore();
  const nodeIndex = useMindMapStore((s) => s.nodeIndex);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const msgCounterRef = useRef(0);
  const getMsgId = useCallback((suffix = "") => `msg-${++msgCounterRef.current}${suffix}`, []);
  const getNow = useCallback(() => Date.now(), []);

  const suggestions = [
    t("chat.suggestion1"),
    t("chat.suggestion2"),
    t("chat.suggestion3"),
    t("chat.suggestion4"),
    t("chat.suggestion5"),
  ];

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  // Current context
  const contextData = useMemo(() => {
    if (!selectedNodeId || !currentProject) return null;
    const path = findNodePathByIndex(currentProject.root, selectedNodeId, nodeIndex);
    if (!path) return null;

    const node = path[path.length - 1];
    const pathString = decodeHTMLEntities(path.map((n) => n.content).join(" > "));
    return { node, pathString };
  }, [selectedNodeId, currentProject]);

  const handleSend = async (textOverride?: string) => {
    const messageText = textOverride || input;
    if (!messageText.trim() || isTyping) return;

    const userMessage = {
      id: getMsgId(),
      role: "user" as const,
      content: messageText.trim(),
      timestamp: getNow(),
    };

    addChatMessage(userMessage);
    if (!textOverride) setInput("");
    setIsTyping(true);

    try {
      const history = [...chatMessages, userMessage];

      setStreamingMessage({
        id: getMsgId("-stream"),
        role: "assistant",
        content: "",
        timestamp: getNow(),
      });

      const aiResponse: AIResponse = await chatWithAI(
        history,
        contextData?.node,
        contextData?.pathString,
        (chunk, isReasoning) => {
          setStreamingMessage((prev) => {
            if (!prev) return prev;
            if (isReasoning) {
              return { ...prev, reasoning: (prev.reasoning || "") + chunk };
            } else {
              return { ...prev, content: prev.content + chunk };
            }
          });
        },
      );

      setStreamingMessage(null);

      // Process AI commands via skill engine
      const { cleanContent, actionLogs } = await processAiCommands(aiResponse.content);

      if (actionLogs.length > 0) {
        setActionLabel(t("chat.actionToast", { count: String(actionLogs.length) }));
        setTimeout(() => setActionLabel(null), 3000);
      }

      const assistantMessage: ChatMessage = {
        id: getMsgId("-result"),
        role: "assistant" as const,
        content: cleanContent,
        timestamp: getNow(),
        reasoning: aiResponse.reasoning || undefined,
      };

      const updatedHistory = [...history, assistantMessage];

      // Auto memory compaction
      const COMPACTION_THRESHOLD = 15;
      if (updatedHistory.length >= COMPACTION_THRESHOLD) {
        console.log("📦 [MemoryEngine] Triggering conversation compaction...");
        const summary = await memoryService.summarizeHistory(updatedHistory);
        const compactedMessage: ChatMessage = {
          id: `msg-compact-${getNow()}`,
          role: "system" as any,
          content: t("chat.compactedMessage") + summary,
          timestamp: getNow(),
          isCompacted: true,
        };
        const newHistory = [compactedMessage, ...updatedHistory.slice(-2)];

        clearChat();
        newHistory.forEach((msg) => addChatMessage(msg));
      } else {
        addChatMessage(assistantMessage);
      }

      // Insert system action logs
      actionLogs.forEach((log, idx) => {
        addChatMessage({
          id: `msg-sys-${getNow() + idx}`,
          role: "system" as any,
          content: t("chat.systemAction") + log,
          timestamp: getNow() + idx,
        });
      });
    } catch (error: any) {
      addChatMessage({
        id: getMsgId("-err"),
        role: "assistant" as const,
        content: `${t("chat.error")}${error.message}`,
        timestamp: getNow(),
      });
    } finally {
      setIsTyping(false);
    }
  };

  const processAiCommands = async (content: string) => {
    const allNodes = currentProject ? flattenNodes(currentProject.root) : [];

    return await skillRegistry.dispatch(content, {
      allNodes,
      root: currentProject?.root,
      nodeIndex,
      appendChildren,
      deleteNodes,
      updateNode,
      messages: chatMessages,
      projectId: currentProject?.id,
      addProjectMemory: (pid: string, fact: string) => {
        useMindMapStore.getState().addProjectMemory(pid, fact);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-title">
          <Brain size={18} className="chat-header-icon" />
          <span>{t("chat.title")}</span>
        </div>
        <div className="chat-header-actions">
          {chatMessages.length > 0 && (
            <button
              className="chat-action-btn"
              onClick={clearChat}
              title={t("chat.clearConversation")}
            >
              <Trash2 size={16} />
            </button>
          )}
          <button className="chat-action-btn" onClick={toggleChat} title={t("chat.closePanel")}>
            <X size={18} />
          </button>
        </div>
      </div>

      {actionLabel && (
        <div className="chat-action-toast animate-fade-in">
          <Sparkles size={12} />
          {actionLabel}
        </div>
      )}

      {/* Context Banner */}
      {contextData && (
        <div className="chat-context-banner">
          <div className="chat-context-label">{t("chat.focusLabel")}</div>
          <div className="chat-context-value" title={contextData.pathString}>
            {contextData.pathString}
          </div>
        </div>
      )}

      {/* Messages or Welcome */}
      {chatMessages.length > 0 ? (
        <div className="chat-messages" ref={scrollRef}>
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className="chat-avatar">
                {msg.role === "assistant" ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className="chat-bubble-wrapper">
                <div className="chat-bubble">
                  {msg.role === "system" ? (
                    <div className="system-log">{msg.content}</div>
                  ) : msg.role === "assistant" ? (
                    <div className="markdown-content">
                      {msg.reasoning && (
                        <details className="reasoning-block">
                          <summary>
                            {t("chat.thinkingLabel", { count: String(msg.reasoning.length) })}
                          </summary>
                          <div className="reasoning-content">
                            <ReactMarkdown>{msg.reasoning}</ReactMarkdown>
                          </div>
                        </details>
                      )}
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role !== "system" && (
                  <div className="chat-time">
                    {new Date(msg.timestamp).toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {streamingMessage && (
            <div className="chat-message assistant">
              <div className="chat-avatar ai">
                <Bot size={16} />
              </div>
              <div className="chat-bubble-wrapper">
                <div className="chat-bubble">
                  <div className="markdown-content">
                    {streamingMessage.reasoning && (
                      <details className="reasoning-block" open>
                        <summary>
                          {t("chat.thinkingLabelActive", {
                            count: String(streamingMessage.reasoning.length),
                          })}
                        </summary>
                        <div className="reasoning-content">
                          <ReactMarkdown>{streamingMessage.reasoning}</ReactMarkdown>
                        </div>
                      </details>
                    )}
                    <ReactMarkdown>{streamingMessage.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isTyping && !streamingMessage && (
            <div className="chat-message assistant">
              <div className="chat-avatar ai">
                <Bot size={14} />
              </div>
              <div className="chat-bubble-wrapper">
                <div className="chat-bubble typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="chat-welcome">
          <div className="chat-welcome-icon">
            <Sparkles size={32} />
          </div>
          <h2 className="chat-welcome-title">{t("chat.welcomeTitle")}</h2>
          <p className="chat-welcome-subtitle">{t("chat.welcomeDesc")}</p>
          <div className="chat-suggestions">
            {suggestions.map((s, i) => (
              <button key={i} className="chat-suggestion-btn" onClick={() => handleSend(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            rows={1}
          />
          <button className="chat-send-btn" onClick={() => handleSend()} disabled={!input.trim()}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
