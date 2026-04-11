import { FileText, FileJson, Sparkles } from 'lucide-react';

export default function DropZoneOverlay() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(10, 10, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      border: '4px dashed var(--color-accent)',
      margin: '20px',
      borderRadius: '24px',
      animation: 'fadeIn 0.2s ease-out',
      pointerEvents: 'none', // Ensure it doesn't block events if logic fails
    }}>
      <div style={{
        background: 'var(--color-bg-tertiary)',
        padding: '40px',
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ padding: '20px', background: 'rgba(124, 92, 252, 0.1)', borderRadius: '16px', color: 'var(--color-accent)' }}>
            <FileText size={48} />
          </div>
          <div style={{ padding: '20px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '16px', color: '#22c55e' }}>
            <FileJson size={48} />
          </div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Sparkles className="animate-pulse" /> 释放鼠标以导入
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '16px' }}>
            支持 Markdown (.md) 和 JSON (.json) 格式备份
          </p>
        </div>
      </div>
    </div>
  );
}
