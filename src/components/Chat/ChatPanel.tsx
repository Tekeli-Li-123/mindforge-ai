import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send, Bot, User, Sparkles, Trash2, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../../types';
import { useMindMapStore } from '../../stores/mindmapStore';
import { chatWithAI, type AIResponse } from '../../services/aiService';
import { skillRegistry } from '../../services/skills';
import { memoryService } from '../../services/memoryService';
import { findNodePath, decodeHTMLEntities, flattenNodes } from '../../utils/mindmapHelpers';
import './ChatPanel.css';

const suggestions = [
  '详细解释当前选中的节点',
  '为当前选中的节点发散子节点',
  '基于当前上下文生成 3 道练习题',
  '总结当前导图的整体学习路线',
  '帮我润色导图中的文字描述',
];

export default function ChatPanel() {
  const { 
    chatMessages, 
    addChatMessage, 
    toggleChat, 
    clearChat, 
    selectedNodeId, 
    currentProject,
    appendChildren,
    updateNode,
    deleteNodes
  } = useMindMapStore();
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  // 计算当前上下文
  const contextData = useMemo(() => {
    if (!selectedNodeId || !currentProject) return null;
    const path = findNodePath(currentProject.root, selectedNodeId);
    if (!path) return null;
    
    const node = path[path.length - 1];
    const pathString = decodeHTMLEntities(path.map(n => n.content).join(' > '));
    return { node, pathString };
  }, [selectedNodeId, currentProject]);

  const handleSend = async (textOverride?: string) => {
    const messageText = textOverride || input;
    if (!messageText.trim() || isTyping) return;

    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user' as const,
      content: messageText.trim(),
      timestamp: Date.now(),
    };

    addChatMessage(userMessage);
    if (!textOverride) setInput('');
    setIsTyping(true);

    try {
      // 包含历史记录
      const history = [...chatMessages, userMessage];

      setStreamingMessage({
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      });

      const aiResponse: AIResponse = await chatWithAI(
        history, 
        contextData?.node, 
        contextData?.pathString,
        (chunk, isReasoning) => {
          setStreamingMessage((prev) => {
            if (!prev) return prev;
            if (isReasoning) {
              return { ...prev, reasoning: (prev.reasoning || '') + chunk };
            } else {
              return { ...prev, content: prev.content + chunk };
            }
          });
        }
      );
      
      setStreamingMessage(null);

      // 处理 AI 指令 - 接入统一技能引擎
      const { cleanContent, actionLogs } = await processAiCommands(aiResponse.content);
      
      if (actionLogs.length > 0) {
        setActionLabel(`✨ AI 已同步执行了 ${actionLogs.length} 项导图变更`);
        setTimeout(() => setActionLabel(null), 3000);
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant' as const,
        content: cleanContent,
        timestamp: Date.now(),
        reasoning: aiResponse.reasoning || undefined,
      };

      // 更新消息列表
      const updatedHistory = [...history, assistantMessage];
      
      // --- 自动记忆管理：历史记录压缩逻辑 ---
      const COMPACTION_THRESHOLD = 15;
      if (updatedHistory.length >= COMPACTION_THRESHOLD) {
        console.log('📦 [MemoryEngine] 触发对话自动压缩...');
        const summary = await memoryService.summarizeHistory(updatedHistory);
        const compactedMessage: ChatMessage = {
          id: `msg-compact-${Date.now()}`,
          role: 'system' as any,
          content: `🕒 对话内容过多，已自动整理摘要：${summary}`,
          timestamp: Date.now(),
          isCompacted: true
        };
        // 保留最后 2 条新消息作为即时上下文，合并之前的为摘要
        const newHistory = [compactedMessage, ...updatedHistory.slice(-2)];
        
        // 我们直接清空并重置消息列表
        clearChat();
        newHistory.forEach(msg => addChatMessage(msg));
      } else {
        addChatMessage(assistantMessage);
      }

      // 批量插入系统操作记录
      actionLogs.forEach((log, idx) => {
        addChatMessage({
          id: `msg-sys-${Date.now() + 2 + idx}`,
          role: 'system' as any,
          content: `✨ 自动执行：${log}`,
          timestamp: Date.now() + 2 + idx,
        });
      });
    } catch (error: any) {
      addChatMessage({
        id: `msg-${Date.now() + 1}`,
        role: 'assistant' as const,
        content: `抱歉，我遇到了一点问题：${error.message}`,
        timestamp: Date.now(),
      });
    } finally {
      setIsTyping(false);
    }
  };

  /**
   * 解析并执行 AI 指令标签
   */
  const processAiCommands = async (content: string) => {
    const allNodes = currentProject ? flattenNodes(currentProject.root) : [];

    // 统一分发至技能注册中心执行
    return await skillRegistry.dispatch(content, {
      allNodes,
      root: currentProject.root,
      appendChildren,
      deleteNodes,
      updateNode,
      // 扩展上下文提供给 MEMORY_FLUSH 等技能使用
      messages: chatMessages,
      projectId: currentProject?.id,
      addProjectMemory: (pid: string, fact: string) => {
        useMindMapStore.getState().addProjectMemory(pid, fact);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
          <span>AI 助手</span>
        </div>
        <div className="chat-header-actions">
          {chatMessages.length > 0 && (
            <button className="chat-action-btn" onClick={clearChat} title="清空对话">
              <Trash2 size={16} />
            </button>
          )}
          <button className="chat-action-btn" onClick={toggleChat} title="关闭侧边栏">
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
          <div className="chat-context-label">当前聚焦：</div>
          <div className="chat-context-value" title={contextData.pathString}>{contextData.pathString}</div>
        </div>
      )}

      {/* Messages or Welcome */}
      {chatMessages.length > 0 ? (
        <div className="chat-messages" ref={scrollRef}>
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className="chat-avatar">
                {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className="chat-bubble-wrapper">
                <div className="chat-bubble">
                  {msg.role === 'system' ? (
                    <div className="system-log">{msg.content}</div>
                  ) : msg.role === 'assistant' ? (
                    <div className="markdown-content">
                      {msg.reasoning && (
                        <details className="reasoning-block">
                          <summary>
                            💭 查看思维过程 ({msg.reasoning.length} 字符)
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
                {msg.role !== 'system' && (
                  <div className="chat-time">
                    {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
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
                          💭 正在思考 ({streamingMessage.reasoning.length} 字符)...
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
          <h2 className="chat-welcome-title">你好！我是 MindForge AI 🧠</h2>
          <p className="chat-welcome-subtitle">
            我是你的 AI 学习助手，不仅能为你答疑解惑，还能直接帮你编辑导图结构。
            你可以通过对话让我添加、修改或删除节点，或者试试下面的快捷指令：
          </p>
          <div className="chat-suggestions">
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="chat-suggestion-btn"
                onClick={() => handleSend(s)}
              >
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
            placeholder="输入消息，和 AI 协作编辑导图..."
            rows={1}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
