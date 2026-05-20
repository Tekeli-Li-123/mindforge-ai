import { useEffect, useRef, useState } from "react";
import { Markmap } from "markmap-view";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  RotateCw,
  Map,
  Sparkles,
  Check,
  X,
  Brain,
  Wand2,
  HelpCircle,
  MessageSquare,
  Download,
  FileText,
  FileJson,
  Image as ImageIcon,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import ReactMarkdown from "react-markdown";
import Modal from "../common/Modal";
import { useMindMapStore } from "../../stores/mindmapStore";
import { useSettingsStore, defaultAISettings } from "../../stores/settingsStore";
import type { MindMapNode } from "../../types";
import {
  findNodePathByIndex,
  generateId,
  parseMarkdownToMindMapNode,
  decodeHTMLEntities,
  convertToMarkmapINode,
  downloadFile,
  nodeToMarkdown,
  exportProjectToJSON,
} from "../../utils/mindmapHelpers";
import ContextMenu, { type ContextMenuPosition } from "./ContextMenu";
import AssessmentModal from "../Assessment/AssessmentModal";
import { useToast } from "../common/Toast";
import {
  generateMindMap,
  explainConcept,
  reorganizeMindMap,
  generateProjectPersona,
} from "../../services/aiService";
import "./MindMapView.css";

export default function MindMapView() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);
  const {
    currentProject,
    updateNode,
    deleteNodes,
    appendChildren,
    updateProjectAIConfig,
    toggleChat,
    isChatOpen,
    selectNode,
    updateProject,
    nodeIndex,
  } = useMindMapStore();

  // Track previous root reference to avoid unnecessary markmap re-renders
  // (e.g. when only aiConfig or updatedAt changes, not the tree itself)
  const prevRootRef = useRef<MindMapNode | null>(null);
  const prevProjectIdRef = useRef<string | null>(null);

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
    type: "edit" | "add_child";
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

  const [isAiConfigOpen, setIsAiConfigOpen] = useState(false);
  const [tempPersona, setTempPersona] = useState("");
  const [isPersonaGenerating, setIsPersonaGenerating] = useState(false);

  // Assessment Modal State
  const [assessmentState, setAssessmentState] = useState<{
    isOpen: boolean;
    node: MindMapNode | null;
    path: string;
  }>({
    isOpen: false,
    node: null,
    path: "",
  });

  // Export Menu State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Dynamic Generation State
  const hasStartedGenerationRef = useRef<boolean>(false);
  const [localGeneratingReasoning, setLocalGeneratingReasoning] = useState<string>("");

  // Track rendering state
  const isRendering = useRef(false);
  const renderRafRef = useRef<number | null>(null);

  // ---------------------------------------------------------
  // Dynamic AI Generation Effect
  // ---------------------------------------------------------
  useEffect(() => {
    if (!currentProject || !currentProject.isGenerating) {
      hasStartedGenerationRef.current = false;
      return;
    }

    if (hasStartedGenerationRef.current) return;
    hasStartedGenerationRef.current = true;

    const req = currentProject.generationPrompt;
    if (!req) {
      updateProject(currentProject.id, { isGenerating: false });
      return;
    }

    let lastUpdate = Date.now();
    let accumulatedText = "";

    generateMindMap(req, (chunk, isReasoning) => {
      if (isReasoning) {
        setLocalGeneratingReasoning((prev) => prev + chunk);
      } else {
        accumulatedText += chunk;
        const now = Date.now();
        // Update canvas every 1000ms to avoid excessive re-renders
        if (now - lastUpdate > 1000) {
          lastUpdate = now;
          try {
            const tempRoot = parseMarkdownToMindMapNode(accumulatedText);
            if (req.title && (!tempRoot.content || tempRoot.content === "")) {
              tempRoot.content = req.title;
            }
            updateProject(currentProject.id, { root: tempRoot });
          } catch (e) {
            // ignore partial parse errors
          }
        }
      }
    })
      .then((markdown) => {
        const finalRoot = parseMarkdownToMindMapNode(markdown);
        if (req.title) finalRoot.content = req.title;
        updateProject(currentProject.id, {
          root: finalRoot,
          isGenerating: false,
          generatingReasoning: "",
          generationPrompt: undefined,
        });
        setLocalGeneratingReasoning("");
      })
      .catch((err) => {
        updateProject(currentProject.id, {
          isGenerating: false,
          root: {
            id: "root",
            content: t("editor.generationFailed", { msg: err.message }),
            depth: 0,
            mastery: 0,
            expanded: true,
            children: [],
          },
        });
        setLocalGeneratingReasoning("");
      });
  }, [
    currentProject?.id,
    currentProject?.isGenerating,
    currentProject?.generationPrompt,
    updateProject,
    t,
  ]);

  // Initialize and update markmap (with adaptive animation and RAF debouncing)
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
          // Adaptive duration: 0 during streaming (no lag), smooth for final render
          const initDuration = currentProject.isGenerating ? 0 : 200;
          mmRef.current = Markmap.create(
            svgRef.current,
            {
              autoFit: false,
              duration: initDuration,
              maxWidth: 250,
              paddingX: 40,
            },
            rootAST,
          );
        } else {
          // During streaming: instant transitions, skip fit to avoid jarring re-centers
          if (!currentProject.isGenerating) {
            const svg = (mmRef.current as any).svg;
            if (svg && svg.selectAll) {
              svg.selectAll("*").interrupt();
            }
          }
          // Override duration on setData — 0 during streaming, smooth for final render
          const setDataDuration = currentProject.isGenerating ? 0 : 200;
          await mmRef.current.setData(rootAST, { duration: setDataDuration });

          if (prevProjectIdRef.current !== currentProject.id) {
            const { width, height } = svgRef.current.getBoundingClientRect();
            if (width > 0 && height > 0) {
              mmRef.current.fit();
            }
            prevProjectIdRef.current = currentProject.id;
          }
        }
      } catch (err) {
        console.error("Markmap render error:", err);
      } finally {
        isRendering.current = false;
      }
    };

    // During streaming: debounce via requestAnimationFrame to batch rapid updates
    if (currentProject.isGenerating) {
      if (renderRafRef.current !== null) return; // Already queued for next frame
      renderRafRef.current = requestAnimationFrame(() => {
        renderRafRef.current = null;
        render();
      });
    } else {
      // Final render: cancel any pending RAF, render immediately
      if (renderRafRef.current !== null) {
        cancelAnimationFrame(renderRafRef.current);
        renderRafRef.current = null;
      }
      render();
    }
  }, [currentProject]);

  // Handle container resizing robustly
  useEffect(() => {
    if (!svgRef.current) return;

    const observer = new ResizeObserver(() => {
      if (mmRef.current && svgRef.current) {
        const { width, height } = svgRef.current.getBoundingClientRect();
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
    const nodeBoxes = document.querySelectorAll(".mindmap-node-box");
    nodeBoxes.forEach((box) => {
      const id = box.getAttribute("data-id");
      if (id && selectedNodes.has(id)) {
        box.classList.add("selected");
      } else {
        box.classList.remove("selected");
      }
    });
  }, [selectedNodes, currentProject]);

  // Global keydown handler for bulk deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent deleting if the user is typing in the inline editor or a textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodes.size > 0) {
        deleteNodes(Array.from(selectedNodes));
        setSelectedNodes(new Set()); // clears selection
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  const handleExportMarkdown = () => {
    if (!currentProject) return;
    const md = nodeToMarkdown(currentProject.root);
    downloadFile(md, `${currentProject.title || "mindmap"}.md`, "text/markdown");
    setIsExportMenuOpen(false);
  };

  const handleExportJSON = () => {
    if (!currentProject) return;
    const json = exportProjectToJSON(currentProject);
    downloadFile(json, `${currentProject.title || "mindmap"}.json`, "application/json");
    setIsExportMenuOpen(false);
  };

  const handleExportImage = async () => {
    if (!svgRef.current) return;

    // Close menu immediately to prevent double-click
    setIsExportMenuOpen(false);

    try {
      const svg = svgRef.current;

      // Capture current view dimensions
      const bbox = svg.getBBox();
      const padding = 40;
      const width = bbox.width + padding * 2;
      const height = bbox.height + padding * 2;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const scale = 2; // HiDPI export
      canvas.width = width * scale;
      canvas.height = height * scale;
      ctx.scale(scale, scale);

      // 1. Draw background
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, width, height);

      // 2. Clone SVG and make it self-contained
      const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clonedSvg.setAttribute("width", width.toString());
      clonedSvg.setAttribute("height", height.toString());
      clonedSvg.setAttribute(
        "viewBox",
        `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`,
      );

      // Inject global CSS variables and base styles
      const styleElement = document.createElement("style");
      styleElement.textContent = `
        .mindmap-node-box {
          background: #1a1a28;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 6px 12px;
          color: #f0f0f5;
          font-family: sans-serif;
          font-size: 14px;
          font-weight: 500;
          display: inline-block;
        }
        .mindmap-root-node {
          background: linear-gradient(135deg, #7c5cfc 0%, #5ca0fc 100%);
          color: white;
          font-weight: bold;
        }
        .markmap-link { stroke: #7c5cfc; stroke-width: 2px; fill: none; opacity: 0.6; }
        .markmap-node circle { fill: #7c5cfc; stroke: #fff; stroke-width: 1px; }
        .node-badge { display: none; }
      `;
      clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);

      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const base64Svg = window.btoa(unescape(encodeURIComponent(svgData)));
      const img = new Image();

      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const pngUrl = canvas.toDataURL("image/png");
          const link = document.createElement("a");
          link.href = pngUrl;
          link.download = `${currentProject?.title || "mindmap"}.png`;
          link.click();
        } catch (e) {
          console.error("Canvas export security error:", e);
          showToast(t("editor.exportFailedCanvas"), "error");
        }
      };

      img.onerror = (e) => {
        console.error("SVG Image loading error (possibly invalid XML):", e);
        showToast(t("editor.exportFailedRender"), "error");
      };

      img.src = "data:image/svg+xml;base64," + base64Svg;
    } catch (err: any) {
      console.error("Export critical error:", err);
      showToast(t("editor.exportFailed") + err.message, "error");
    }
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    setContextMenuPos(null); // Close any existing
    setInlineEditor(null);

    // Check if we hit a node
    const target = e.target as HTMLElement;
    const nodeBox = target.closest(".mindmap-node-box");

    if (nodeBox) {
      const nodeId = nodeBox.getAttribute("data-id");
      if (nodeId) {
        if (e.ctrlKey || e.metaKey) {
          // Add/Remove from selection
          setSelectedNodes((prev) => {
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
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setMarquee({
        isDrawing: true,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (marquee?.isDrawing) {
      e.stopPropagation();
      setMarquee({
        ...marquee,
        currentX: e.clientX,
        currentY: e.clientY,
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

      // Calculate intersection only if a drag actually occurred
      if (rectRight - rectLeft > 5 || rectBottom - rectTop > 5) {
        const nodeBoxes = document.querySelectorAll(".mindmap-node-box");
        const newlySelected = new Set(selectedNodes);

        nodeBoxes.forEach((box) => {
          const id = box.getAttribute("data-id");
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

      setTimeout(() => setMarquee(null), 10);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    setContextMenuPos(null);
    setInlineEditor(null);

    const target = e.target as HTMLElement;
    const nodeBox = target.closest(".mindmap-node-box");

    if (nodeBox) {
      const nodeId = nodeBox.getAttribute("data-id");
      if (nodeId) {
        setActiveNodeId(nodeId);
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const openInlineEditor = (type: "edit" | "add_child", nodeId: string) => {
    const nodeBox = document.querySelector(`.mindmap-node-box[data-id="${nodeId}"]`);
    if (nodeBox) {
      const rect = nodeBox.getBoundingClientRect();
      const parentRect = svgRef.current?.parentElement?.getBoundingClientRect();

      if (parentRect) {
        const x = rect.left - parentRect.left;
        const y = rect.top - parentRect.top;

        let initialText = "";
        if (type === "edit") {
          initialText = nodeBox.textContent || "";
        }

        setInlineEditor({
          nodeId,
          type,
          initialText,
          x,
          y,
          w: rect.width,
          h: rect.height,
        });
      }
    }
  };

  const handleInlineEditorSubmit = (text: string) => {
    if (!inlineEditor || !text.trim()) {
      setInlineEditor(null);
      return;
    }

    if (inlineEditor.type === "edit") {
      updateNode(inlineEditor.nodeId, { content: text });
    } else if (inlineEditor.type === "add_child") {
      appendChildren(inlineEditor.nodeId, [
        { id: generateId(), content: text, depth: 0, mastery: 0, expanded: true, children: [] },
      ]);
    }

    setInlineEditor(null);
  };

  const handleAction = async (
    action:
      | "edit"
      | "add_child"
      | "add_sibling"
      | "delete"
      | "delete_children"
      | "ai_refine"
      | "explain"
      | "explain_regen"
      | "reorganize"
      | "assessment",
  ) => {
    if (!activeNodeId || !currentProject) return;

    const targetNodeIds =
      selectedNodes.has(activeNodeId) && selectedNodes.size > 1
        ? Array.from(selectedNodes)
        : [activeNodeId];

    if (action === "delete") {
      deleteNodes(targetNodeIds);
      setSelectedNodes(new Set());
    } else if (action === "delete_children") {
      targetNodeIds.forEach((id) => updateNode(id, { children: [] }));
      setSelectedNodes(new Set());
    } else if (action === "edit" || action === "add_child") {
      openInlineEditor(action, activeNodeId);
    } else if (action === "ai_refine") {
      setRefineConfig({
        isOpen: true,
        nodeIds: targetNodeIds,
        depth: 2,
        maxNodes: 0,
      });
    } else if (action === "explain" || action === "explain_regen") {
      const isMulti = targetNodeIds.length > 1;
      const isRegen = action === "explain_regen";

      if (isMulti) {
        setExplanation({
          title: isRegen ? t("editor.batchRegenerate") : t("editor.batchExplain"),
          content: t("editor.thinkingForNodes", { count: String(targetNodeIds.length) }),
          isOpen: true,
        });
      } else {
        const path = findNodePathByIndex(currentProject.root, targetNodeIds[0], nodeIndex);
        const targetName = path ? decodeHTMLEntities(path[path.length - 1].content) : "";
        setExplanation({
          title: targetName,
          content: t("editor.thinkingExplain", {
            regen: isRegen ? t("editor.regenerate") + " " : "",
          }),
          isOpen: true,
        });
      }

      let combinedExp = "";
      for (const tId of targetNodeIds) {
        let targetNodeData: any = null;
        const findNode = (n: any) => {
          if (n.id === tId) targetNodeData = n;
          n.children.forEach(findNode);
        };
        findNode(currentProject.root);

        const path = findNodePathByIndex(currentProject.root, tId, nodeIndex);
        if (!path) continue;

        const targetName = decodeHTMLEntities(path[path.length - 1].content);
        const contextString = decodeHTMLEntities(path.map((n) => n.content).join(" > "));

        // Use cache only if not regenerating
        if (!isRegen && targetNodeData?.explanation) {
          combinedExp += `### ${targetName}\n${targetNodeData.explanation}\n\n`;
          continue;
        }

        try {
          const result = await explainConcept(targetName, contextString);
          const currentTags = targetNodeData?.tags || [];
          if (!currentTags.includes("explained")) {
            currentTags.push("explained");
          }
          updateNode(tId, { explanation: result, tags: currentTags });
          combinedExp += `### ${targetName}\n${result}\n\n`;
          if (isMulti)
            setExplanation({
              title: t("editor.batchExplain"),
              content: combinedExp + "\n*" + t("editor.processingNext") + "... ✨*",
              isOpen: true,
            });
        } catch (e: any) {
          combinedExp += `### ${targetName}\n${t("editor.explainFailed")}\n${e.message}\n\n`;
        }
      }
      const finalTitle = isMulti
        ? isRegen
          ? t("editor.batchReorganizeResult")
          : t("editor.batchExplainResult")
        : decodeHTMLEntities(
            findNodePathByIndex(currentProject.root, targetNodeIds[0], nodeIndex)?.slice(-1)[0]
              ?.content || "",
          );
      setExplanation({ title: finalTitle, content: combinedExp, isOpen: true });
    } else if (action === "reorganize") {
      setIsAiLoading(true);

      for (const tId of targetNodeIds) {
        let targetNodeData: any = null;
        const findNode = (n: any) => {
          if (n.id === tId) targetNodeData = n;
          n.children.forEach(findNode);
        };
        findNode(currentProject.root);

        if (!targetNodeData || targetNodeData.children.length === 0) {
          if (targetNodeIds.length === 1) showToast(t("editor.noChildrenToReorganize"), "warning");
          continue;
        }

        const path = findNodePathByIndex(currentProject.root, tId, nodeIndex);
        const targetName = path ? decodeHTMLEntities(path[path.length - 1].content) : "";
        const contextString = path
          ? decodeHTMLEntities(path.map((n) => n.content).join(" > "))
          : "";

        let childrenMarkdown = "";
        targetNodeData.children.forEach((c: any) => {
          childrenMarkdown += nodeToMarkdown(c, 1, true);
        });

        updateNode(tId, { content: targetName + t("editor.reorganizing") });

        try {
          const markdown = await reorganizeMindMap(childrenMarkdown, contextString);
          const fakeRoot = `# ROOT\n${markdown}`;
          const parsedTree = parseMarkdownToMindMapNode(fakeRoot);

          updateNode(tId, { content: targetName, children: parsedTree.children });
        } catch (e: any) {
          if (targetNodeIds.length === 1)
            showToast(t("editor.reorganizeFailed") + e.message, "error");
          updateNode(tId, { content: targetName });
        }
      }
      setIsAiLoading(false);
    } else if (action === "assessment") {
      const path = findNodePathByIndex(currentProject.root, activeNodeId, nodeIndex);
      if (path) {
        setAssessmentState({
          isOpen: true,
          node: path[path.length - 1],
          path: path.map((n) => n.content).join(" > "),
        });
      }
    }
  };

  const executeAiRefine = async () => {
    if (!refineConfig || !currentProject) return;
    const { nodeIds, maxNodes } = refineConfig;

    setRefineConfig(null);
    setIsAiLoading(true);

    const originalNames: Record<string, string> = {};
    for (const nId of nodeIds) {
      const path = findNodePathByIndex(currentProject.root, nId, nodeIndex);
      if (!path) continue;
      const targetName = decodeHTMLEntities(path[path.length - 1].content);
      originalNames[nId] = targetName;
      updateNode(nId, { content: targetName + t("editor.refining") });
    }

    for (const nId of nodeIds) {
      const path = findNodePathByIndex(currentProject.root, nId, nodeIndex);
      if (!path) continue;

      const targetName = originalNames[nId] || decodeHTMLEntities(path[path.length - 1].content);
      const contextString = decodeHTMLEntities(path.map((n) => n.content).join(" > "));

      try {
        const refinePrompt =
          useSettingsStore.getState().aiSettings.refinePrompt || defaultAISettings.refinePrompt;
        const limitInstruction =
          maxNodes === 0
            ? `Strictly limited: generate only 1 level of direct subordinate concepts. The number of child nodes is for you to **judge** — find the necessary and reasonable number of categories to cover the essence of the concept. Absolutely do NOT generate deeper sub-nodes!`
            : `Strictly limited: generate only 1 level of direct subordinate concepts, max ${maxNodes} nodes. Absolutely do NOT generate deeper sub-nodes!`;

        const compiledPrompt = refinePrompt
          .replace(/\{\{target\}\}/g, targetName)
          .replace(/\{\{context\}\}/g, contextString)
          .replace(/\{\{limitInstruction\}\}/g, limitInstruction);

        const persona = currentProject.aiConfig?.persona || "";
        const personaPrefix = persona ? `Your persona is: ${persona}\n\n` : "";

        let accumulatedText = "";
        let lastUpdate = Date.now();
        const existingNode = findNodePathByIndex(currentProject.root, nId, nodeIndex)?.pop();
        const existingChildren = existingNode?.children || [];

        const parseFlatMarkdown = (md: string) => {
          const lines = md.split("\n");
          const subNodes: any[] = [];
          for (let line of lines) {
            line = line.replace(/```(?:markdown)?/g, "").trim();
            if (!line) continue;
            const text = line.replace(/^[\s\-*#\d.]+/, "").trim();
            if (text && text.length > 0) {
              subNodes.push({
                id: generateId(),
                content: decodeHTMLEntities(text),
                depth: (existingNode?.depth || 0) + 1,
                mastery: 0,
                expanded: true,
                children: [],
              });
            }
          }
          return subNodes;
        };

        const markdown = await generateMindMap(
          {
            prompt: compiledPrompt,
            systemPromptOverride:
              personaPrefix +
              "You are a strict classification extractor that follows commands. Your only task is to extract 'direct categories or characteristics' for a given concept. Critically important: always generate only 1 level flat list! Use Markdown unordered list (- or *) to list items directly. Never use # headings for deep nesting. No explanations.",
          },
          (chunk, isReasoning) => {
            if (isReasoning) {
              setLocalGeneratingReasoning((prev) => prev + chunk);
            } else {
              accumulatedText += chunk;
              const now = Date.now();
              if (now - lastUpdate > 1000) {
                lastUpdate = now;
                const tempSubNodes = parseFlatMarkdown(accumulatedText);
                updateNode(nId, { children: [...existingChildren, ...tempSubNodes] });
              }
            }
          },
        );

        const finalSubNodes = parseFlatMarkdown(markdown);
        updateNode(nId, { content: targetName, children: [...existingChildren, ...finalSubNodes] });
        setLocalGeneratingReasoning("");
      } catch (e: any) {
        if (nodeIds.length === 1) showToast(t("editor.refineFailed") + e.message, "error");
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
          <p>{t("editor.noProject")}</p>
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
        touchAction: marquee?.isDrawing ? "none" : "auto",
        userSelect: marquee?.isDrawing ? "none" : "auto",
        WebkitUserSelect: marquee?.isDrawing ? "none" : "auto",
      }}
    >
      {(currentProject?.isGenerating || localGeneratingReasoning) && (
        <div className="generation-overlay">
          <div className="generation-spinner">
            <Sparkles className="spin-icon" size={20} />
            <span>
              {currentProject?.isGenerating ? t("editor.generatingMap") : t("editor.thinking")}
            </span>
          </div>
          {localGeneratingReasoning && (
            <details className="generation-reasoning" open>
              <summary>
                {t("editor.thinkingLabel", { count: String(localGeneratingReasoning.length) })}
              </summary>
              <div className="reasoning-content">
                <ReactMarkdown>{localGeneratingReasoning}</ReactMarkdown>
              </div>
            </details>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        id="mindmap-svg"
        onContextMenu={handleContextMenu}
        onClick={handleSvgClick}
      />

      {/* Toolbar */}
      <div className="mindmap-toolbar">
        <button className="mindmap-toolbar-btn" onClick={handleZoomIn} title={t("editor.zoomIn")}>
          <ZoomIn size={18} />
        </button>
        <button className="mindmap-toolbar-btn" onClick={handleZoomOut} title={t("editor.zoomOut")}>
          <ZoomOut size={18} />
        </button>
        <div className="mindmap-toolbar-divider" />
        <button className="mindmap-toolbar-btn" onClick={handleFit} title={t("editor.fitWindow")}>
          <Maximize2 size={18} />
        </button>
        <button className="mindmap-toolbar-btn" title={t("editor.reset")} onClick={() => {}}>
          <RotateCcw size={18} />
        </button>
        <div className="mindmap-toolbar-divider" />
        <button
          className={`mindmap-toolbar-btn ${currentProject.aiConfig ? "active" : ""}`}
          style={{ color: currentProject.aiConfig ? "var(--color-accent)" : "inherit" }}
          onClick={() => {
            setTempPersona(currentProject.aiConfig?.persona || "");
            setIsAiConfigOpen(true);
          }}
          title={t("editor.aiConfig")}
        >
          <Brain size={18} />
        </button>

        <div className="mindmap-export-wrapper">
          <button
            className={`mindmap-toolbar-btn ${isExportMenuOpen ? "active" : ""}`}
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            title={t("editor.export")}
          >
            <Download size={18} />
          </button>

          {isExportMenuOpen && (
            <div className="mindmap-export-menu glass animate-fade-in">
              <div className="export-menu-item" onClick={handleExportMarkdown}>
                <FileText size={16} />
                <span>{t("editor.exportAsMarkdown")}</span>
              </div>
              <div className="export-menu-item" onClick={handleExportJSON}>
                <FileJson size={16} />
                <span>{t("editor.exportAsJSON")}</span>
              </div>
              <div className="export-menu-item" onClick={handleExportImage}>
                <ImageIcon size={16} />
                <span>{t("editor.exportAsPNG")}</span>
              </div>
            </div>
          )}
        </div>

        <button
          className={`mindmap-toolbar-btn ${isChatOpen ? "active" : ""}`}
          style={{ color: isChatOpen ? "var(--color-accent)" : "inherit" }}
          onClick={toggleChat}
          title={t("editor.toggleChat")}
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

      {/* Assessment Modal */}
      {assessmentState.node && (
        <AssessmentModal
          isOpen={assessmentState.isOpen}
          onClose={() => setAssessmentState({ ...assessmentState, isOpen: false })}
          node={assessmentState.node}
          contextPath={assessmentState.path}
        />
      )}

      {/* Marquee UI */}
      {marquee?.isDrawing && (
        <div
          className="selection-marquee"
          style={{
            left: Math.min(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY),
            width: Math.abs(marquee.currentX - marquee.startX),
            height: Math.abs(marquee.currentY - marquee.startY),
          }}
        />
      )}

      {/* Inline Editor Overlay */}
      {inlineEditor && (
        <div
          style={{
            position: "absolute",
            left: inlineEditor.x - 2,
            top: inlineEditor.y - 2,
            zIndex: 1000,
            background: "var(--color-bg-tertiary)",
            border: "2px solid var(--color-accent)",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            padding: "6px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          <input
            type="text"
            defaultValue={inlineEditor.initialText}
            autoFocus
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-primary)",
              fontSize: "14px",
              fontWeight: 500,
              fontFamily: "inherit",
              outline: "none",
              minWidth: Math.max(inlineEditor.w, 150) + "px",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleInlineEditorSubmit(e.currentTarget.value);
              } else if (e.key === "Escape") {
                setInlineEditor(null);
              }
            }}
          />
          <button
            style={{
              background: "var(--color-accent)",
              border: "none",
              color: "#fff",
              borderRadius: "4px",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
            }}
            onClick={(e) =>
              handleInlineEditorSubmit((e.currentTarget.previousSibling as HTMLInputElement).value)
            }
          >
            <Check size={14} />
          </button>
          <button
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
              borderRadius: "4px",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
            }}
            onClick={() => setInlineEditor(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {isAiLoading && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            padding: "8px 16px",
            background: "var(--color-accent)",
            color: "white",
            borderRadius: 20,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
            opacity: 0.9,
          }}
        >
          <Sparkles style={{ width: 14, height: 14, flexShrink: 0 }} className="animate-spin" />
          {t("editor.aiThinking")}
        </div>
      )}

      <Modal
        isOpen={explanation?.isOpen || false}
        onClose={() => setExplanation((e) => (e ? { ...e, isOpen: false } : null))}
        title={`${t("editor.explanationTitle")}${explanation?.title}`}
        footer={
          <div style={{ display: "flex", gap: "8px", width: "100%", justifyContent: "flex-end" }}>
            <button
              className="modal-btn secondary"
              style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}
              onClick={() => {
                const targetId = activeNodeId;
                if (targetId) handleAction("explain_regen");
              }}
            >
              <RotateCw style={{ width: 14, height: 14, flexShrink: 0 }} /> {t("editor.regenerate")}
            </button>
            <button
              className="modal-btn primary"
              onClick={() => setExplanation((e) => (e ? { ...e, isOpen: false } : null))}
            >
              {t("editor.readDone")}
            </button>
          </div>
        }
      >
        <div
          style={{
            padding: "16px",
            background: "var(--color-bg-tertiary)",
            borderRadius: "8px",
            lineHeight: 1.6,
            color: "var(--color-text-primary)",
          }}
          className="markdown-prose"
        >
          <ReactMarkdown>{explanation?.content || ""}</ReactMarkdown>
        </div>
      </Modal>

      {/* Refine Config Modal */}
      <Modal
        isOpen={refineConfig?.isOpen || false}
        onClose={() => setRefineConfig(null)}
        title={t("editor.refineTitle")}
        footer={
          <>
            <button className="modal-btn secondary" onClick={() => setRefineConfig(null)}>
              {t("editor.cancel")}
            </button>
            <button
              className="modal-btn primary"
              style={{
                background: "var(--color-accent-gradient)",
                color: "white",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
              onClick={executeAiRefine}
            >
              <Sparkles size={16} style={{ width: "16px", height: "16px", flex: "0 0 16px" }} />{" "}
              <span>{t("editor.singleLayer")}</span>
            </button>
          </>
        }
      >
        <div style={{ padding: "8px 4px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                fontSize: "14px",
                color: "var(--color-text-secondary)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{t("editor.maxNodes")}</span>
              <span
                style={{
                  color:
                    refineConfig?.maxNodes === 0
                      ? "var(--color-success, #22c55e)"
                      : "var(--color-accent)",
                }}
              >
                {refineConfig?.maxNodes === 0
                  ? t("editor.auto")
                  : `${refineConfig?.maxNodes} ${t("editor.nodes")}`}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="15"
              step="1"
              value={refineConfig?.maxNodes === undefined ? 0 : refineConfig?.maxNodes}
              onChange={(e) =>
                setRefineConfig((prev) =>
                  prev ? { ...prev, maxNodes: parseInt(e.target.value) } : null,
                )
              }
              style={{
                accentColor:
                  refineConfig?.maxNodes === 0
                    ? "var(--color-success, #22c55e)"
                    : "var(--color-accent)",
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--color-text-tertiary)" }}>
              {refineConfig?.maxNodes === 0 ? t("editor.autoDesc") : t("editor.manualDesc")}
            </span>
          </div>
        </div>
      </Modal>

      {/* Project AI Config Modal */}
      <Modal
        isOpen={isAiConfigOpen}
        onClose={() => setIsAiConfigOpen(false)}
        title={t("editor.aiConfigTitle")}
        footer={
          <>
            <button className="modal-btn secondary" onClick={() => setIsAiConfigOpen(false)}>
              {t("editor.cancel")}
            </button>
            <button
              className="modal-btn primary"
              onClick={() => {
                updateProjectAIConfig(currentProject.id, {
                  persona: tempPersona,
                  explainStyle: currentProject.aiConfig?.explainStyle || "intermediate",
                });
                setIsAiConfigOpen(false);
              }}
            >
              {t("editor.save")}
            </button>
          </>
        }
      >
        <div style={{ padding: "4px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label
                style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-secondary)" }}
              >
                {t("editor.personaLabel")}
              </label>
              <button
                onClick={async () => {
                  try {
                    setIsPersonaGenerating(true);
                    const config = await generateProjectPersona(
                      currentProject.description,
                      currentProject.title,
                      tempPersona,
                    );
                    setTempPersona(config.persona);
                    updateProjectAIConfig(currentProject.id, config);
                  } catch (e: any) {
                    showToast(t("editor.genPersonaFailed") + e.message, "error");
                  } finally {
                    setIsPersonaGenerating(false);
                  }
                }}
                disabled={isPersonaGenerating}
                style={{
                  background: "rgba(168, 85, 247, 0.1)",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  color: "#a855f7",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <Wand2
                  style={{ width: 14, height: 14, flexShrink: 0 }}
                  className={isPersonaGenerating ? "animate-spin" : ""}
                />
                <span style={{ whiteSpace: "nowrap" }}>
                  {isPersonaGenerating
                    ? t("editor.personaGenerateLoading")
                    : t("editor.personaGenerate")}
                </span>
              </button>
            </div>
            <textarea
              className="modal-textarea"
              placeholder={t("editor.personaPlaceholder")}
              value={tempPersona}
              onChange={(e) => setTempPersona(e.target.value)}
              style={{
                minHeight: "100px",
                fontSize: "14px",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            <span
              style={{
                fontSize: "12px",
                color: "var(--color-text-tertiary)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <HelpCircle style={{ width: 14, height: 14, flexShrink: 0 }} />{" "}
              {t("editor.personaHint")}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-secondary)" }}
            >
              {t("editor.explainStyle")}
            </label>
            <div
              style={{
                display: "flex",
                gap: "8px",
                background: "var(--color-bg-secondary)",
                padding: "4px",
                borderRadius: "8px",
              }}
            >
              {(["beginner", "intermediate", "expert"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() =>
                    updateProjectAIConfig(currentProject.id, {
                      ...(currentProject.aiConfig || { persona: tempPersona }),
                      explainStyle: style,
                    })
                  }
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: "none",
                    fontSize: "13px",
                    cursor: "pointer",
                    background:
                      currentProject.aiConfig?.explainStyle === style
                        ? "var(--color-accent)"
                        : "transparent",
                    color:
                      currentProject.aiConfig?.explainStyle === style
                        ? "#fff"
                        : "var(--color-text-secondary)",
                    transition: "all 0.2s",
                  }}
                >
                  {style === "beginner"
                    ? t("editor.beginner")
                    : style === "intermediate"
                      ? t("editor.intermediate")
                      : t("editor.expert")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
