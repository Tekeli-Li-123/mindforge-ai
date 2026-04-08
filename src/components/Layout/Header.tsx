import { useLocation } from 'react-router-dom';
import { MessageSquare, Sparkles } from 'lucide-react';
import { useMindMapStore } from '../../stores/mindmapStore';
import './Header.css';

const pageTitles: Record<string, string> = {
  '/': '仪表盘',
  '/editor': '知识导图',
  '/quiz': '知识考核',
  '/settings': '设置',
};

export default function Header() {
  const location = useLocation();
  const { isChatOpen, toggleChat } = useMindMapStore();

  const title = pageTitles[location.pathname] || '未知页面';

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">
        {location.pathname === '/editor' && (
          <button
            className={`header-btn ${isChatOpen ? 'active' : ''}`}
            onClick={toggleChat}
            title="AI 助手"
          >
            <MessageSquare size={18} />
            {!isChatOpen && <span className="header-btn-badge" />}
          </button>
        )}
        <button className="header-btn" title="AI 生成">
          <Sparkles size={18} />
        </button>
      </div>
    </header>
  );
}
