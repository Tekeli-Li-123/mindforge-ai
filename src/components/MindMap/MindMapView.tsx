import { useEffect, useRef, useState } from 'react';
import { Markmap } from 'markmap-view';
import { Transformer } from 'markmap-lib';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Map, Sparkles, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Modal from '../common/Modal';
import { useMindMapStore } from '../../stores/mindmapStore';
import { useSettingsStore, defaultAISettings } from '../../stores/settingsStore';
import { nodeToMarkdown, findNodePath, generateId, parseMarkdownToMindMapNode, decodeHTMLEntities } from '../../utils/mindmapHelpers';
import ContextMenu, { type ContextMenuPosition } from './ContextMenu';
import { generateMindMap, explainConcept, reorganizeMindMap } from '../../services/aiService';
import './MindMapView.css';

const transformer = new Transformer();

export default function MindMapView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);
  const { currentProject, updateNode, deleteNode, deleteNodes, appendChildren } = useMindMapStore();
  
  // Context Menu State
  const [contextMenuPos, setContextMenuPos] = useState<ContextMenuPosition | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Multi-select State
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  
  // Marquee Selection Box State
  const [marquee, setMarquee] = useState<{
    isDrawing: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // AI Loading State
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Inline Editor State
  const [inlineEditor, setInlineEditor] = useState<{
    nodeId: string;
    type: 'edit' | 'add_child';
    initialText: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // Explanation Modal State
  const [explanation, setExplanation] = useState<{
    title: string;
    content: string;
    isOpen: boolean;
  } | null>(null);

  // Refine Config Modal State
  const [refineConfig, setRefineConfig] = useState<{
    isOpen: boolean;
    nodeId: string;
    depth: number;
    maxNodes: number;
  } | null>(null);

  // Initialize and update markmap
  useEffect(() => {
    if (!svgRef.current || !currentProject) return;

    const markdown = nodeToMarkdown(currentProject.root);
    const { root } = transformer.transform(markdown);

    if (!mmRef.current) {
      // First render: create Markmap instance
      mmRef.current = Markmap.create(svgRef.current, {
        autoFit: true,
        duration: 300,
        maxWidth: 250, // 增加自适应换行最大宽度
        paddingX: 40,
        paddingY: 30,  // 设置适当的垂直间距
      }, root);
    } else {
      // Subsequent renders: update data
      mmRef.current.setData(root).finally(() => {
        mmRef.current?.fit();
      });
    }
  }, [currentProject]);

  // Synchronize multi-select classes via DOM mapping to bypass markmap redraw
  useEffect(() => {
    const nodeBoxes = document.querySelectorAll('.mindmap-node-box');
    nodeBoxes.forEach(box => {
      const id = box.getAttribute('data-id');
      if (id && selectedNodes.has(id)) {
        box.classList.add('selected');
      } else {
        box.classList.remove('selected');
      }
    });
  }, [selectedNodes, currentProject]);

  // Global keydown handler for bulk deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent deleting if the user is typing in the inline editor or a textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodes.size > 0) {
        deleteNodes(Array.from(selectedNodes));
        setSelectedNodes(new Set()); // clears selection
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes, deleteNodes]);

  // Cleanup
  useEffect(() => {
    return () => {
      mmRef.current?.destroy();
      mmRef.current = null;
    };
  }, []);

  const handleFit = () => mmRef.current?.fit();

  const handleZoomIn = () => {
    mmRef.current?.rescale(1.3);
  };

  const handleZoomOut = () => {
    mmRef.current?.rescale(0.7);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    setContextMenuPos(null); // Close any existing
    setInlineEditor(null);
    
    // Check if we hit a node
    const target = e.target as HTMLElement;
    const nodeBox = target.closest('.mindmap-node-box');
    
    if (nodeBox) {
      const nodeId = nodeBox.getAttribute('data-id');
      if (nodeId) {
        if (e.ctrlKey || e.metaKey) {
          // Add/Remove from selection
          setSelectedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
              next.delete(nodeId);
            } else {
              next.add(nodeId);
            }
            return next;
          });
        } else {
          // Normal click clears existing multi-select
          setSelectedNodes(new Set());
        }
      }
    } else {
      // Clicked on empty space
      setSelectedNodes(new Set());
    }
  };



  // --- Marquee Pointer Hijacking Handlers ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      // Clicking on node or dragged? Let's check if it's over a node! 
      // Actually we want to lasso from background mostly, but lassoing from above a node should work.
      // D3 catches mousedown on SVG natively via listeners, we must stop it from propagating down in capture phase.
      e.stopPropagation();
      e.preventDefault(); // <-- This prevents the browser from starting a native text highlight selection!
      e.currentTarget.setPointerCapture(e.pointerId);
      setMarquee({
        isDrawing: true,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (marquee?.isDrawing) {
      e.stopPropagation();
      setMarquee({
        ...marquee,
        currentX: e.clientX,
        currentY: e.clientY
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (marquee?.isDrawing) {
      e.stopPropagation();
      e.currentTarget.releasePointerCapture(e.pointerId);
      
      const { startX, startY, currentX, currentY } = marquee;
      const rectLeft = Math.min(startX, currentX);
      const rectRight = Math.max(startX, currentX);
      const rectTop = Math.min(startY, currentY);
      const rectBottom = Math.max(startY, currentY);
      
      // Calculate intersection only if a drag actually occurred (avoiding single click intercept misfires)
      if (rectRight - rectLeft > 5 || rectBottom - rectTop > 5) {
        const nodeBoxes = document.querySelectorAll('.mindmap-node-box');
        const newlySelected = new Set(selectedNodes);
        
        nodeBoxes.forEach(box => {
          const id = box.getAttribute('data-id');
          if (id) {
            const domRect = box.getBoundingClientRect();
            const intersects = !(
              domRect.right < rectLeft ||
              domRect.left > rectRight ||
              domRect.bottom < rectTop ||
              domRect.top > rectBottom
            );
            if (intersects) newlySelected.add(id);
          }
        });
        
        setSelectedNodes(newlySelected);
      }
      
      // Small timeout allows click event queue to resolve knowing marquee was active
      setTimeout(() => setMarquee(null), 10);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    setContextMenuPos(null);
    setInlineEditor(null);
    
    // Find if we clicked on a node box
    const target = e.target as HTMLElement;
    const nodeBox = target.closest('.mindmap-node-box');
    
    if (nodeBox) {
      const nodeId = nodeBox.getAttribute('data-id');
      if (nodeId) {
        setActiveNodeId(nodeId);
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const openInlineEditor = (type: 'edit' | 'add_child', nodeId: string) => {
    const nodeBox = document.querySelector(`.mindmap-node-box[data-id="${nodeId}"]`);
    if (nodeBox) {
      const rect = nodeBox.getBoundingClientRect();
      const parentRect = svgRef.current?.parentElement?.getBoundingClientRect();
      
      if (parentRect) {
        // Calculate position relative to the container
        const x = rect.left - parentRect.left;
        const y = rect.top - parentRect.top;
        
        let initialText = '';
        if (type === 'edit') {
           initialText = nodeBox.textContent || '';
        }

        setInlineEditor({
          nodeId,
          type,
          initialText,
          x,
          y,
          w: rect.width,
          h: rect.height
        });
      }
    }
  };

  const handleInlineEditorSubmit = (text: string) => {
    if (!inlineEditor || !text.trim()) {
      setInlineEditor(null);
      return;
    }
    
    if (inlineEditor.type === 'edit') {
      updateNode(inlineEditor.nodeId, { content: text });
    } else if (inlineEditor.type === 'add_child') {
      appendChildren(inlineEditor.nodeId, [{ id: generateId(), content: text, depth: 0, mastery: 0, expanded: true, children: [] }]);
    }
    
    setInlineEditor(null);
  };

  const handleAction = async (action: 'edit' | 'add_child' | 'add_sibling' | 'delete' | 'ai_refine') => {
    if (!activeNodeId || !currentProject) return;

    if (action === 'delete') {
      deleteNode(activeNodeId);
    } else if (action === 'edit' || action === 'add_child') {
      openInlineEditor(action, activeNodeId);
    } else if (action === 'ai_refine') {
      setRefineConfig({
        isOpen: true,
        nodeId: activeNodeId,
        depth: 2,
        maxNodes: 5
      });
    } else if (action === 'explain') {
      let targetNodeData: any = null;
      const findNode = (n: any) => {
        if (n.id === activeNodeId) targetNodeData = n;
        n.children.forEach(findNode);
      };
      findNode(currentProject.root);

      const path = findNodePath(currentProject.root, activeNodeId);
      if (!path) return;
      
      const targetName = decodeHTMLEntities(path[path.length - 1]);
      const contextString = decodeHTMLEntities(path.join(' > '));
      
      // Cache Strategy: read explanation immediately
      if (targetNodeData?.explanation) {
        setExplanation({ title: targetName, content: targetNodeData.explanation, isOpen: true });
        return;
      }

      setExplanation({ title: targetName, content: '正在思考解释，请稍候... ✨', isOpen: true });
      
      try {
        const result = await explainConcept(targetName, contextString);
        // Persist explanation and add tag
        const currentTags = targetNodeData?.tags || [];
        if (!currentTags.includes('explained')) {
           currentTags.push('explained');
        }
        updateNode(activeNodeId, { explanation: result, tags: currentTags });
        setExplanation({ title: targetName, content: result, isOpen: true });
      } catch(e: any) {
        setExplanation({ title: targetName, content: `解释失败 😔\n${e.message}`, isOpen: true });
      }
    } else if (action === 'reorganize') {
      // Find the deeply nested target node structure
      // To reorganize, we extract all its child content into markdown
      let targetNodeData: any = null;
      // Re-find target node in tree
      const findNode = (n: any) => {
        if (n.id === activeNodeId) targetNodeData = n;
        n.children.forEach(findNode);
      };
      findNode(currentProject.root);
      
      if (!targetNodeData || targetNodeData.children.length === 0) {
        alert('当前节点没有任何子节点，无法重组。');
        return;
      }

      const path = findNodePath(currentProject.root, activeNodeId);
      const targetName = path ? decodeHTMLEntities(path[path.length - 1]) : '';
      const contextString = path ? decodeHTMLEntities(path.join(' > ')) : '';
      
      // Convert current children to pure markdown list block for AI
      let childrenMarkdown = '';
      targetNodeData.children.forEach((c: any) => {
         childrenMarkdown += nodeToMarkdown(c, 1, true);
      });

      setIsAiLoading(true);
      updateNode(activeNodeId, { content: targetName + ' (✨ 施展魔法重组中...)' });
      
      try {
        const markdown = await reorganizeMindMap(childrenMarkdown, contextString);
        
        // Use arbitrary trick to wrap the returned content before parsing
        const fakeRoot = `# ROOT\n${markdown}`;
        const parsedTree = parseMarkdownToMindMapNode(fakeRoot);
        
        // Overwrite the target node's children with the new tree's children
        updateNode(activeNodeId, { content: targetName, children: parsedTree.children });
      } catch(e: any) {
        alert('AI 重组失败: ' + e.message);
        updateNode(activeNodeId, { content: targetName });
      } finally {
        setIsAiLoading(false);
      }
    }
  };

  const executeAiRefine = async () => {
    if (!refineConfig || !currentProject) return;
    const { nodeId, depth, maxNodes } = refineConfig;
    
    setRefineConfig(null);
    const path = findNodePath(currentProject.root, nodeId);
    if (!path) return;
    
    const targetName = decodeHTMLEntities(path[path.length - 1]);
    const contextString = decodeHTMLEntities(path.join(' > '));
    
    setIsAiLoading(true);
    updateNode(nodeId, { content: targetName + ' (✨ 细化中...)' });
    
    try {
      const refinePrompt = useSettingsStore.getState().aiSettings.refinePrompt || defaultAISettings.refinePrompt;
      const limitInstruction = `严格限制生成深度不超过 ${depth} 级，且每个分支下的子节点数量最多 ${maxNodes} 个，保持精简。`;
      
      let compiledPrompt = refinePrompt
        .replace(/\{\{target\}\}/g, targetName)
        .replace(/\{\{context\}\}/g, contextString)
        .replace(/\{\{limitInstruction\}\}/g, limitInstruction);

      const markdown = await generateMindMap({ prompt: compiledPrompt });
      
      const parsedTree = parseMarkdownToMindMapNode(markdown);
      const subNodes = parsedTree.children.length > 0 ? parsedTree.children : [parsedTree];
      
      if (subNodes.length === 1 && subNodes[0].content === targetName) {
         appendChildren(nodeId, subNodes[0].children);
      } else {
         appendChildren(nodeId, subNodes);
      }
      
      updateNode(nodeId, { content: targetName });
    } catch(e: any) {
      alert('AI 细化失败: ' + e.message);
      updateNode(nodeId, { content: targetName });
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="mindmap-container">
        <div className="mindmap-empty animate-fade-in">
          <div className="mindmap-empty-icon">
            <Map size={28} />
          </div>
          <p>尚未打开导图项目，请从仪表盘选择或创建新导图</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="mindmap-container"
      onPointerDownCapture={handlePointerDown}
      onPointerMoveCapture={handlePointerMove}
      onPointerUpCapture={handlePointerUp}
      style={{ 
        touchAction: marquee?.isDrawing ? 'none' : 'auto',
        userSelect: marquee?.isDrawing ? 'none' : 'auto',
        WebkitUserSelect: marquee?.isDrawing ? 'none' : 'auto'
      }}
    >
      <svg 
        ref={svgRef} 
        id="mindmap-svg" 
        onContextMenu={handleContextMenu}
        onClick={handleSvgClick}
      />

      {/* Toolbar */}
      <div className="mindmap-toolbar">
        <button className="mindmap-toolbar-btn" onClick={handleZoomIn} title="放大">
          <ZoomIn size={18} />
        </button>
        <button className="mindmap-toolbar-btn" onClick={handleZoomOut} title="缩小">
          <ZoomOut size={18} />
        </button>
        <div className="mindmap-toolbar-divider" />
        <button className="mindmap-toolbar-btn" onClick={handleFit} title="适应窗口">
          <Maximize2 size={18} />
        </button>
        <button className="mindmap-toolbar-btn" title="重置" onClick={() => {}}>
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Interactive Context Menu */}
      <ContextMenu 
        position={contextMenuPos} 
        onClose={() => setContextMenuPos(null)}
        onAction={handleAction}
      />

      {/* Marquee UI */}
      {marquee?.isDrawing && (
        <div 
          className="selection-marquee"
          style={{
            left: Math.min(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY),
            width: Math.abs(marquee.currentX - marquee.startX),
            height: Math.abs(marquee.currentY - marquee.startY)
          }}
        />
      )}
      
      {/* Inline Editor Overlay */}
      {inlineEditor && (
        <div style={{
          position: 'absolute',
          left: inlineEditor.x - 2,
          top: inlineEditor.y - 2,
          zIndex: 1000,
          background: 'var(--color-bg-tertiary)',
          border: '2px solid var(--color-accent)',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          padding: '6px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          <input
            type="text"
            defaultValue={inlineEditor.initialText}
            autoFocus
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-primary)',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'inherit',
              outline: 'none',
              minWidth: Math.max(inlineEditor.w, 150) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleInlineEditorSubmit(e.currentTarget.value);
              } else if (e.key === 'Escape') {
                setInlineEditor(null);
              }
            }}
          />
          <button 
           style={{ background: 'var(--color-accent)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', padding: '4px', display: 'flex' }}
           onClick={(e) => handleInlineEditorSubmit((e.currentTarget.previousSibling as HTMLInputElement).value)}
          >
            <Check size={14} />
          </button>
          <button 
           style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: '4px', cursor: 'pointer', padding: '4px', display: 'flex' }}
           onClick={() => setInlineEditor(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {isAiLoading && (
        <div style={{ position: 'absolute', top: 16, right: 16, padding: '8px 16px', background: 'var(--color-accent)', color: 'white', borderRadius: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.9 }}>
          <Sparkles style={{ width: 14, height: 14, flexShrink: 0 }} className="animate-spin" />
          AI 正在思考处理中...
        </div>
      )}

      <Modal
        isOpen={explanation?.isOpen || false}
        onClose={() => setExplanation(e => e ? { ...e, isOpen: false } : null)}
        title={`词条解释：${explanation?.title}`}
        footer={
          <button className="modal-btn primary" onClick={() => setExplanation(e => e ? { ...e, isOpen: false } : null)}>
            阅毕
          </button>
        }
      >
        <div style={{
          padding: '16px',
          background: 'var(--color-bg-tertiary)',
          borderRadius: '8px',
          lineHeight: 1.6,
          color: 'var(--color-text-primary)'
        }} className="markdown-prose">
          <ReactMarkdown>{explanation?.content || ''}</ReactMarkdown>
        </div>
      </Modal>

      {/* Refine Config Modal */}
      <Modal
        isOpen={refineConfig?.isOpen || false}
        onClose={() => setRefineConfig(null)}
        title="AI 节点发散设置"
        footer={
          <>
            <button className="modal-btn secondary" onClick={() => setRefineConfig(null)}>取消</button>
            <button className="modal-btn primary" style={{ background: 'var(--color-accent-gradient)', color: 'white', border: 'none' }} onClick={executeAiRefine}>
              <Sparkles size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> 发散生长
            </button>
          </>
        }
      >
        <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>发散深度层级 (Depth)</span>
              <span style={{ color: 'var(--color-accent)' }}>{refineConfig?.depth} 层</span>
            </label>
            <input 
              type="range" 
              min="1" max="4" step="1"
              value={refineConfig?.depth || 2}
              onChange={(e) => setRefineConfig(prev => prev ? {...prev, depth: parseInt(e.target.value)} : null)}
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>控制 AI 向下属发散拓展的层数限制。</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>单层最大节点数 (Max Nodes)</span>
              <span style={{ color: 'var(--color-accent)' }}>{refineConfig?.maxNodes} 个</span>
            </label>
            <input 
              type="range" 
              min="2" max="15" step="1"
              value={refineConfig?.maxNodes || 5}
              onChange={(e) => setRefineConfig(prev => prev ? {...prev, maxNodes: parseInt(e.target.value)} : null)}
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>控制每一次拆分的颗粒度，避免单层内容爆炸。</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
