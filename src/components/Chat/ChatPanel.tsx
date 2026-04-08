import { useState } from 'react';
import { X, Send, Bot, User, Sparkles } from 'lucide-react';
import { useMindMapStore } from '../../stores/mindmapStore';
import './ChatPanel.css';

const suggestions = [
  '展开"监督学习"节点的详细内容',
  '帮我解释什么是决策树',
  '基于当前导图生成考核题目',
  '重新组织导图结构',
];

export default function ChatPanel() {
  const { chatMessages, addChatMessage, toggleChat } = useMindMapStore();
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    addChatMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    });

    // Simulate AI response (placeholder)
    setTimeout(() => {
      addChatMessage({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `收到你的消息："${input.trim()}"。AI 功能正在开发中，敬请期待！🚀`,
        timestamp: Date.now(),
      });
    }, 500);

    setInput('');
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
          <span className="chat-header-dot" />
          AI 助手
        </div>
        <button className="chat-close-btn" onClick={toggleChat}>
          <X size={16} />
        </button>
      </div>

      {/* Messages or Welcome */}
      {chatMessages.length === 0 ? (
        <div className="chat-welcome animate-fade-in">
          <div className="chat-welcome-icon">
            <Sparkles size={22} />
          </div>
          <h3>你好！我是 MindForge AI 🧠</h3>
          <p>我可以帮你展开知识点、解释概念、生成考核题目，试试下面的快捷指令：</p>
          <div className="chat-suggestions">
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="chat-suggestion-btn"
                onClick={() => setInput(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="chat-messages">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className={`chat-avatar ${msg.role === 'user' ? 'user' : 'ai'}`}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div>
                <div className="chat-bubble">{msg.content}</div>
                <div className="chat-time">
                  {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))}
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
