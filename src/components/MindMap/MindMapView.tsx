import { useEffect, useRef, useState } from 'react';
import { Markmap } from 'markmap-view';
import { Transformer } from 'markmap-lib';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, RotateCw, Map, Sparkles, Check, X, Brain, Wand2, HelpCircle, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Modal from '../common/Modal';
import { useMindMapStore } from '../../stores/mindmapStore';
import { useSettingsStore, defaultAISettings } from '../../stores/settingsStore';
import type { MindMapNode } from '../../types';
import { findNodePath, generateId, parseMarkdownToMindMapNode, decodeHTMLEntities, convertToMarkmapINode } from '../../utils/mindmapHelpers';
import ContextMenu, { type ContextMenuPosition } from './ContextMenu';
import { generateMindMap, explainConcept, reorganizeMindMap, generateProjectPersona } from '../../services/aiService';
import './MindMapView.css';

const transformer = new Transformer();

export default function MindMapView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);
  const { 
    currentProject, 
    updateNode, 
    deleteNode, 
    deleteNodes, 
    appendChildren, 
    updateProjectAIConfig,
    toggleChat,
    isChatOpen,
    selectNode
  } = useMindMapStore();
  
  // Track previous root reference to avoid unnecessary markmap re-renders
  // (e.g. when only aiConfig or updatedAt changes, not the tree itself)
  const prevRootRef = useRef<MindMapNode | null>(null);

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
    nodeIds: string[];
    depth: number;
    maxNodes: number;
  } | null>(null);

  // Project AI Config Modal State
  const [isAiConfigOpen, setIsAiConfigOpen] = useState(false);
  const [tempPersona, setTempPersona] = useState('');
  const [isPersonaGenerating, setIsPersonaGenerating] = useState(false);

  // Track rendering state
  const isRendering = useRef(false);

  // Initialize and update markmap
  useEffect(() => {
    if (!svgRef.current || !currentProject) return;

    // Skip redundant updates if the tree reference is the same
    if (mmRef.current && prevRootRef.current === currentProject.root) return;
    prevRootRef.current = currentProject.root;

    const render = async () => {
      if (!svgRef.current || isRendering.current) return;
      isRendering.current = true;

      try {
        const rootAST = convertToMarkmapINode(currentProject.root);
        
        if (!mmRef.current) {
          mmRef.current = Markmap.create(svgRef.current, {
            autoFit: true,
            duration: 300,
            maxWidth: 250,
            paddingX: 40,
            paddingY: 30,
          }, rootAST);
        } else {
          // Interrupt all ongoing d3 transitions to prevent NaN interpolation conflicts
          const svg = (mmRef.current as any).svg;
          if (svg && svg.selectAll) {
            svg.selectAll('*').interrupt();
          }
          
          await mmRef.current.setData(rootAST);
          
          // Only fit if the container has dimensions
          const { width, height } = svgRef.current.getBoundingClientRect();
          if (width > 0 && height > 0) {
            mmRef.current.fit();
          }
        }
      } catch (err) {
        console.error('Markmap render error:', err);
      } finally {
        isRendering.current = false;
      }
    };

    render();
  }, [currentProject]);

  // Handle container resizing robustly
  useEffect(() => {
    if (!svgRef.current) return;
    
    const observer = new ResizeObserver(() => {
      if (mmRef.current) {
        const { width, height } = svgRef.current!.getBoundingClientRect();
        if (width > 0 && height > 0) {
          mmRef.current.fit();
        }
      }
    });
    
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);

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
          // Normal click clears existing multi-select and selects the node for chat
          setSelectedNodes(new Set());
          selectNode(nodeId);
        }
      }
    } else {
      // Clicked on empty space
      setSelectedNodes(new Set());
      selectNode(null);
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

  const handleAction = async (action: 'edit' | 'add_child' | 'add_sibling' | 'delete' | 'delete_children' | 'ai_refine' | 'explain' | 'explain_regen' | 'reorganize') => {
    if (!activeNodeId || !currentProject) return;

    const targetNodeIds = selectedNodes.has(activeNodeId) && selectedNodes.size > 1 
      ? Array.from(selectedNodes) 
      : [activeNodeId];

    if (action === 'delete') {
      deleteNodes(targetNodeIds);
      setSelectedNodes(new Set());
    } else if (action === 'delete_children') {
      targetNodeIds.forEach(id => updateNode(id, { children: [] }));
      setSelectedNodes(new Set());
    } else if (action === 'edit' || action === 'add_child') {
      // 只能单节点编辑
      openInlineEditor(action, activeNodeId);
    } else if (action === 'ai_refine') {
      setRefineConfig({
        isOpen: true,
        nodeIds: targetNodeIds,
        depth: 2,
        maxNodes: 0 // 0 means Auto
      });
    } else if (action === 'explain' || action === 'explain_regen') {
      const isMulti = targetNodeIds.length > 1;
      const isRegen = action === 'explain_regen';
      
      if (isMulti) {
        setExplanation({ title: isRegen ? '批量重新生成' : '批量解释', content: `正在思考 ${targetNodeIds.length} 个节点的解释... ✨`, isOpen: true });
      } else {
        const path = findNodePath(currentProject.root, targetNodeIds[0]);
        const targetName = path ? decodeHTMLEntities(path[path.length - 1].content) : '';
        setExplanation({ title: targetName, content: `正在${isRegen ? '重新' : ''}思考解释... ✨`, isOpen: true });
      }

      let combinedExp = '';
      for (const tId of targetNodeIds) {
        let targetNodeData: any = null;
        const findNode = (n: any) => {
          if (n.id === tId) targetNodeData = n;
          n.children.forEach(findNode);
        };
        findNode(currentProject.root);

        const path = findNodePath(currentProject.root, tId);
        if (!path) continue;
        
        const targetName = decodeHTMLEntities(path[path.length - 1].content);
        const contextString = decodeHTMLEntities(path.map(n => n.content).join(' > '));
        
        // 只有在非重新生成模式下才使用缓存
        if (!isRegen && targetNodeData?.explanation) {
          combinedExp += `### ${targetName}\n${targetNodeData.explanation}\n\n`;
          continue;
        }

        try {
          const result = await explainConcept(targetName, contextString);
          const currentTags = targetNodeData?.tags || [];
          if (!currentTags.includes('explained')) {
             currentTags.push('explained');
          }
          updateNode(tId, { explanation: result, tags: currentTags });
          combinedExp += `### ${targetName}\n${result}\n\n`;
          // 更新临时弹窗状态以显示进度
          if (isMulti) setExplanation({ title: '批量解释 (处理中)', content: combinedExp + '\n*处理下一个... ✨*', isOpen: true });
        } catch(e: any) {
          combinedExp += `### ${targetName}\n解释失败 😔\n${e.message}\n\n`;
        }
      }
      const finalTitle = isMulti ? (isRegen ? '批量重构结果' : '批量解释结果') : decodeHTMLEntities(findNodePath(currentProject.root, targetNodeIds[0])?.slice(-1)[0]?.content || '');
      setExplanation({ title: finalTitle, content: combinedExp, isOpen: true });
    } else if (action === 'reorganize') {
      setIsAiLoading(true);

      for (const tId of targetNodeIds) {
        let targetNodeData: any = null;
        const findNode = (n: any) => {
          if (n.id === tId) targetNodeData = n;
          n.children.forEach(findNode);
        };
        findNode(currentProject.root);
        
        if (!targetNodeData || targetNodeData.children.length === 0) {
          if (targetNodeIds.length === 1) alert('当前节点没有任何子节点，无法重组。');
          continue;
        }

        const path = findNodePath(currentProject.root, tId);
        const targetName = path ? decodeHTMLEntities(path[path.length - 1].content) : '';
        const contextString = path ? decodeHTMLEntities(path.map(n => n.content).join(' > ')) : '';
        
        let childrenMarkdown = '';
        targetNodeData.children.forEach((c: any) => {
           childrenMarkdown += nodeToMarkdown(c, 1, true);
        });

        updateNode(tId, { content: targetName + ' (✨ 施展魔法重组中...)' });
        
        try {
          const markdown = await reorganizeMindMap(childrenMarkdown, contextString);
          const fakeRoot = `# ROOT\n${markdown}`;
          const parsedTree = parseMarkdownToMindMapNode(fakeRoot);
          
          updateNode(tId, { content: targetName, children: parsedTree.children });
        } catch(e: any) {
          if (targetNodeIds.length === 1) alert('AI 重组失败: ' + e.message);
          updateNode(tId, { content: targetName });
        }
      }
      setIsAiLoading(false);
    }
  };

  const executeAiRefine = async () => {
    if (!refineConfig || !currentProject) return;
    const { nodeIds, depth, maxNodes } = refineConfig;
    
    setRefineConfig(null);
    setIsAiLoading(true);

    const originalNames: Record<string, string> = {};
    for (const nId of nodeIds) {
      const path = findNodePath(currentProject.root, nId);
      if (!path) continue;
      const targetName = decodeHTMLEntities(path[path.length - 1]);
      originalNames[nId] = targetName;
      updateNode(nId, { content: targetName + ' (✨ 细化中...)' });
    }
    
    for (const nId of nodeIds) {
      const path = findNodePath(currentProject.root, nId);
      if (!path) continue;
      
      const targetName = originalNames[nId] || decodeHTMLEntities(path[path.length - 1]);
      const contextString = decodeHTMLEntities(path.join(' > '));
      
      try {
        const refinePrompt = useSettingsStore.getState().aiSettings.refinePrompt || defaultAISettings.refinePrompt;
        const limitInstruction = maxNodes === 0 
          ? `严格限制：必须且只能生成 1 层深度的直接下级概念列表。子节点数量由你**自行判断**，找出涵盖该概念精髓所需的必要、合理的分类数即可，但绝对不要生成更深层级的次级节点！`
          : `严格限制：必须且只能生成 1 层深度的直接下级概念列表，节点数量最多不超过 ${maxNodes} 个。绝对不要生成更深层级的次级节点！`;
        
        let compiledPrompt = refinePrompt
          .replace(/\{\{target\}\}/g, targetName)
          .replace(/\{\{context\}\}/g, contextString)
          .replace(/\{\{limitInstruction\}\}/g, limitInstruction);

        const persona = currentProject.aiConfig?.persona || "";
        const personaPrefix = persona ? `你的人设是：${persona}\n\n` : "";

        const markdown = await generateMindMap({ 
          prompt: compiledPrompt,
          systemPromptOverride: personaPrefix + "你是一个严格执行命令的分类提取器。你的任务仅仅是为一个概念提取出它的『直接分类或特征』。极其重要：每次只能生成 1 层扁平列表！请必须使用 Markdown 无序列表（- 或 *）来直接罗列，绝对不可使用 # 标题进行深度嵌套树化，不要任何解释。"
        });
        
        // 对于单层发散的平铺列表提取，我们直接执行字符串行解析，完美规避 AST 无根节点引起的解析崩溃
        const lines = markdown.split('\n');
        const subNodes: any[] = [];
        for (let line of lines) {
           line = line.replace(/```(?:markdown)?/g, '').trim();
           if (!line) continue;
           const text = line.replace(/^[\s\-\*\#\d\.]+/, '').trim();
           if (text && text.length > 0) {
               subNodes.push({
                   id: generateId(),
                   content: decodeHTMLEntities(text),
                   depth: 0,
                   mastery: 0,
                   expanded: true,
                   children: []
               });
           }
        }
        
        appendChildren(nId, subNodes);
        
        updateNode(nId, { content: targetName });
      } catch(e: any) {
        if (nodeIds.length === 1) alert('AI 细化失败: ' + e.message);
        updateNode(nId, { content: targetName });
      }
    }
    setIsAiLoading(false);
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
        <div className="mindmap-toolbar-divider" />
        <button 
          className={`mindmap-toolbar-btn ${currentProject.aiConfig ? 'active' : ''}`} 
          style={{ color: currentProject.aiConfig ? 'var(--color-accent)' : 'inherit' }}
          onClick={() => {
            setTempPersona(currentProject.aiConfig?.persona || '');
            setIsAiConfigOpen(true);
          }} 
          title="项目 AI 人设设定"
        >
          <Brain size={18} />
        </button>
        <button 
          className={`mindmap-toolbar-btn ${isChatOpen ? 'active' : ''}`} 
          style={{ color: isChatOpen ? 'var(--color-accent)' : 'inherit' }}
          onClick={toggleChat} 
          title="打开/关闭 AI 助手"
        >
          <MessageSquare size={18} />
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
          <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
            <button 
              className="modal-btn secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              onClick={() => {
                const targetId = activeNodeId;
                if (targetId) handleAction('explain_regen');
              }}
            >
              <RotateCw style={{ width: 14, height: 14, flexShrink: 0 }} /> 重新生成
            </button>
            <button className="modal-btn primary" onClick={() => setExplanation(e => e ? { ...e, isOpen: false } : null)}>
              阅毕
            </button>
          </div>
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
        title="AI 节点发散提取"
        footer={
          <>
            <button className="modal-btn secondary" onClick={() => setRefineConfig(null)}>取消</button>
            <button className="modal-btn primary" style={{ background: 'var(--color-accent-gradient)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' }} onClick={executeAiRefine}>
              <Sparkles size={16} style={{ width: '16px', height: '16px', flex: '0 0 16px' }} /> <span>单层发散</span>
            </button>
          </>
        }
      >
        <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>发散提取数量 (Max Nodes)</span>
              <span style={{ color: refineConfig?.maxNodes === 0 ? 'var(--color-success, #22c55e)' : 'var(--color-accent)' }}>
                {refineConfig?.maxNodes === 0 ? '自动 (Auto)' : `${refineConfig?.maxNodes} 个`}
              </span>
            </label>
            <input 
              type="range" 
              min="0" max="15" step="1"
              value={refineConfig?.maxNodes === undefined ? 0 : refineConfig?.maxNodes}
              onChange={(e) => setRefineConfig(prev => prev ? {...prev, maxNodes: parseInt(e.target.value)} : null)}
              style={{ accentColor: refineConfig?.maxNodes === 0 ? 'var(--color-success, #22c55e)' : 'var(--color-accent)' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
              {refineConfig?.maxNodes === 0 
                ? '由 AI 自动评估当前知识点，提取出最合适合理的分类数量。' 
                : '控制本次要向下提取出多少个同级的直接细分子类/知识点。'}
            </span>
          </div>
        </div>
      </Modal>

      {/* Project AI Config Modal */}
      <Modal
        isOpen={isAiConfigOpen}
        onClose={() => setIsAiConfigOpen(false)}
        title="当前项目 AI 人设设定"
        footer={
          <>
            <button className="modal-btn secondary" onClick={() => setIsAiConfigOpen(false)}>取消</button>
            <button 
              className="modal-btn primary" 
              onClick={() => {
                updateProjectAIConfig(currentProject.id, {
                  persona: tempPersona,
                  explainStyle: currentProject.aiConfig?.explainStyle || 'intermediate'
                });
                setIsAiConfigOpen(false);
              }}
            >
              保存设定
            </button>
          </>
        }
      >
        <div style={{ padding: '4px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                AI 专家人设描述 (Persona)
              </label>
              <button 
                onClick={async () => {
                  try {
                    setIsPersonaGenerating(true);
                    const config = await generateProjectPersona(currentProject.description, currentProject.title, tempPersona);
                    setTempPersona(config.persona);
                    updateProjectAIConfig(currentProject.id, config);
                  } catch (e: any) {
                    alert("智能生成失败: " + e.message);
                  } finally {
                    setIsPersonaGenerating(false);
                  }
                }}
                disabled={isPersonaGenerating}
                style={{ 
                  background: 'rgba(168, 85, 247, 0.1)', 
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  color: '#a855f7',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Wand2 style={{ width: 14, height: 14, flexShrink: 0 }} className={isPersonaGenerating ? 'animate-spin' : ''} />
                <span style={{ whiteSpace: 'nowrap' }}>{isPersonaGenerating ? '正在炼丹...' : 'AI 智能生成'}</span>
              </button>
            </div>
            <textarea 
              className="modal-textarea"
              placeholder="例如：你是一位拥有 10 年经验的资深架构师，回答严谨且深入底层。"
              value={tempPersona}
              onChange={(e) => setTempPersona(e.target.value)}
              style={{ minHeight: '100px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle style={{ width: 14, height: 14, flexShrink: 0 }} /> 人设将深度影响 AI 的“解释概念”和“发散细化”的语气与专业程度。
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              默认知识深度 (Explain Style)
            </label>
            <div style={{ display: 'flex', gap: '8px', background: 'var(--color-bg-secondary)', padding: '4px', borderRadius: '8px' }}>
              {(['beginner', 'intermediate', 'expert'] as const).map(style => (
                <button
                  key={style}
                  onClick={() => updateProjectAIConfig(currentProject.id, {
                    ...(currentProject.aiConfig || { persona: tempPersona }),
                    explainStyle: style
                  })}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: currentProject.aiConfig?.explainStyle === style ? 'var(--color-accent)' : 'transparent',
                    color: currentProject.aiConfig?.explainStyle === style ? '#fff' : 'var(--color-text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  {style === 'beginner' ? '入门' : style === 'intermediate' ? '进阶' : '专家'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
