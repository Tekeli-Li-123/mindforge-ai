import { useEffect, useRef } from 'react';
import { Sparkles, Edit2, PlusCircle, Trash2, BookOpen, Network } from 'lucide-react';
import './ContextMenu.css';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuProps {
  position: ContextMenuPosition | null;
  onClose: () => void;
  onAction: (action: 'edit' | 'add_child' | 'add_sibling' | 'delete' | 'ai_refine' | 'explain' | 'reorganize') => void;
}

export default function ContextMenu({ position, onClose, onAction }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (position) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [position, onClose]);

  if (!position) return null;

  // Prevent menu going offscreen
  const style: React.CSSProperties = {
    top: position.y,
    left: position.x,
  };

  return (
    <div className="context-menu-overlay" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div 
        className="context-menu" 
        style={style} 
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button className="context-menu-item highlight" onClick={() => { onAction('ai_refine'); onClose(); }}>
          <Sparkles style={{ width: 16, height: 16, flexShrink: 0 }} className="gradient-text" /> 
          <span className="gradient-text">AI 细化探索</span>
        </button>
        <button className="context-menu-item highlight" style={{ background: 'rgba(59, 130, 246, 0.1)' }} onClick={() => { onAction('explain'); onClose(); }}>
          <BookOpen style={{ width: 16, height: 16, flexShrink: 0, color: '#3b82f6' }} /> 
          <span style={{ color: '#3b82f6', fontWeight: 500 }}>解释概念</span>
        </button>
        <button className="context-menu-item highlight" style={{ background: 'rgba(234, 179, 8, 0.1)' }} onClick={() => { onAction('reorganize'); onClose(); }}>
          <Network style={{ width: 16, height: 16, flexShrink: 0, color: '#eab308' }} /> 
          <span style={{ color: '#eab308', fontWeight: 500 }}>重组子导图</span>
        </button>
        <div className="context-menu-divider" />
        <button className="context-menu-item" onClick={() => { onAction('edit'); onClose(); }}>
          <Edit2 style={{ width: 16, height: 16, flexShrink: 0 }} /> 编辑文本
        </button>
        <button className="context-menu-item" onClick={() => { onAction('add_child'); onClose(); }}>
          <PlusCircle style={{ width: 16, height: 16, flexShrink: 0 }} /> 插入子概念
        </button>
        <div className="context-menu-divider" />
        <button className="context-menu-item danger" onClick={() => { onAction('delete'); onClose(); }}>
          <Trash2 style={{ width: 16, height: 16, flexShrink: 0 }} /> 删除节点
        </button>
      </div>
    </div>
  );
}
