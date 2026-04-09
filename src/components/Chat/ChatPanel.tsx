import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send, Bot, User, Sparkles, Trash2, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useMindMapStore } from '../../stores/mindmapStore';
import { chatWithAI } from '../../services/aiService';
import { findNodePath, decodeHTMLEntities, generateId, flattenNodes } from '../../utils/mindmapHelpers';
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
      const rawAiResponse = await chatWithAI(history, contextData?.node, contextData?.pathString);
      
      // 处理 AI 指令
      const { cleanContent, actionLogs } = processAiCommands(rawAiResponse);
      
      if (actionLogs.length > 0) {
        setActionLabel(`✨ AI 已同步执行了 ${actionLogs.length} 项导图变更`);
        setTimeout(() => setActionLabel(null), 3000);
      }

      addChatMessage({
        id: `msg-${Date.now() + 1}`,
        role: 'assistant' as const,
        content: cleanContent,
        timestamp: Date.now(),
      });

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
  const processAiCommands = (content: string) => {
    let cleanContent = content;
    const actionLogs: string[] = [];

    const allNodes = currentProject ? flattenNodes(currentProject.root) : [];

    // 1. 处理 ADD 指令
    const addRegex = /\[\[ADD:([^:]+):([^\]]+)\]\]/g;
    let addMatch;
    while ((addMatch = addRegex.exec(content)) !== null) {
      const [, parentId, nodeContent] = addMatch;
      const parentNode = allNodes.find(n => n.id === parentId);
      
      appendChildren(parentId, [{
        id: generateId(),
        content: nodeContent.trim(),
        children: [],
        depth: 0,
        mastery: 0,
        expanded: true
      }]);
      
      actionLogs.push(`在节点“${parentNode?.content || parentId}”下添加了“${nodeContent.trim()}”`);
      cleanContent = cleanContent.replace(addMatch[0], '');
    }

    // 2. 处理 DELETE 指令
    const deleteRegex = /\[\[DELETE:([^\]]+)\]\]/g;
    let deleteMatch;
    while ((deleteMatch = deleteRegex.exec(content)) !== null) {
      const [, nodeId] = deleteMatch;
      const targetNode = allNodes.find(n => n.id === nodeId);
      
      deleteNodes([nodeId]);
      actionLogs.push(`删除了节点“${targetNode?.content || nodeId}”`);
      cleanContent = cleanContent.replace(deleteMatch[0], '');
    }

    // 3. 处理 RENAME 指令
    const renameRegex = /\[\[RENAME:([^:]+):([^\]]+)\]\]/g;
    let renameMatch;
    while ((renameMatch = renameRegex.exec(content)) !== null) {
      const [, nodeId, newContent] = renameMatch;
      const targetNode = allNodes.find(n => n.id === nodeId);
      
      updateNode(nodeId, { content: newContent.trim() });
      actionLogs.push(`将节点“${targetNode?.content || nodeId}”重命名为“${newContent.trim()}”`);
      cleanContent = cleanContent.replace(renameMatch[0], '');
    }

    // 4. 处理 SAVE_EXPLAIN 指令
    const saveRegex = /\[\[SAVE_EXPLAIN:([^:]+):([^\]]+)\]\]/g;
    let saveMatch;
    while ((saveMatch = saveRegex.exec(content)) !== null) {
      const [, nodeId, explainContent] = saveMatch;
      const targetNode = allNodes.find(n => n.id === nodeId);
      
      if (targetNode) {
        const oldTags = targetNode.tags || [];
        const newTags = oldTags.includes('explained') ? oldTags : [...oldTags, 'explained'];
        updateNode(nodeId, { 
          explanation: explainContent.trim(), 
          tags: newTags 
        });
        actionLogs.push(`已将详细解释同步至节点“${targetNode.content}”`);
      }
      cleanContent = cleanContent.replace(saveMatch[0], '');
    }

    return { cleanContent: cleanContent.trim(), actionLogs };
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
          {isTyping && (
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
