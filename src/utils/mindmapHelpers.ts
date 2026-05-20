import type { MindMapNode } from "../types";

/** 将包含 HTML 实体（如 &#x786c;）的字符串还原为正常字符 */
export function decodeHTMLEntities(text: string): string {
  if (!text) return "";
  const textArea = document.createElement("textarea");
  textArea.innerHTML = text;
  return textArea.value;
}

/** 通用文件下载函数 */
export function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** 统计导图节点总数 */
export function countNodes(node: MindMapNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

/** 计算导图平均掌握度 */
export function averageMastery(node: MindMapNode): number {
  let total = 0;
  let count = 0;

  function traverse(n: MindMapNode) {
    total += n.mastery;
    count += 1;
    n.children.forEach(traverse);
  }

  traverse(node);
  return count > 0 ? total / count : 0;
}

/** 生成唯一 ID */
export function generateId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 根据掌握度获取颜色 (HSL 热力图) */
export function getMasteryColor(mastery: number, alpha: number = 1): string {
  // 掌握度 0 -> 红色 (0°), 掌握度 1 -> 绿色 (120°)
  const hue = mastery * 120;
  return `hsla(${hue}, 70%, 55%, ${alpha})`;
}

/** 根据掌握度获取标签 */
export function getMasteryLabel(mastery: number): string {
  if (mastery >= 0.8) return "精通";
  if (mastery >= 0.6) return "熟练";
  if (mastery >= 0.3) return "了解";
  if (mastery > 0) return "入门";
  return "未学";
}

/** 扁平化导图节点 */
export function flattenNodes(node: MindMapNode): MindMapNode[] {
  return [node, ...node.children.flatMap(flattenNodes)];
}

/** 扁平化所有节点并包含完整路径，用于给 AI 提供精确的全局定位 */
export function flattenNodesWithPaths(
  node: MindMapNode,
  parentPath: string = "",
): { id: string; content: string; path: string }[] {
  const currentPath = parentPath ? `${parentPath} > ${node.content}` : node.content;
  let result = [{ id: node.id, content: node.content, path: currentPath }];
  for (const child of node.children) {
    result = [...result, ...flattenNodesWithPaths(child, currentPath)];
  }
  return result;
}

/**
 * 将 MindMapNode 转为 Markdown（用于 markmap 或 AI prompt）
 * @param forAI 如果为 true，则产出纯净的文本格式给 AI；否则注入用于 UI 的额外 DOM（如标签等）
 */
export function nodeToMarkdown(
  node: MindMapNode,
  level: number = 1,
  forAI: boolean = false,
): string {
  let prefix;
  if (forAI) {
    prefix = "#".repeat(level) + " ";
  } else {
    // 渲染 UI 时，除了根节点用 #，其下全部用完全缩进的无序列表，完美避开 H6 极限后的混合解析错误！
    if (level === 1) {
      prefix = "# ";
    } else {
      prefix = "  ".repeat(level - 2) + "- ";
    }
  }

  if (forAI) {
    let md = `${prefix}${node.content}\n`;
    for (const child of node.children) {
      md += nodeToMarkdown(child, level + 1, true);
    }
    return md;
  }

  const rootClass = level === 1 ? " mindmap-root-node" : "";
  let tagsHtml = "";

  if (node.tags && node.tags.includes("explained")) {
    tagsHtml += `<span class="node-badge" title="已包含详细解释">📖</span>`;
  }

  let md = `${prefix}<div data-id="${node.id}" class="mindmap-node-box${rootClass}">${node.content}${tagsHtml}</div>\n`;
  for (const child of node.children) {
    md += nodeToMarkdown(child, level + 1, false);
  }
  return md;
}

/**
 * 构建节点 ID → 父节点 ID 的索引表 (O(n) 单次遍历)
 * 用于将 findNodePath / 树操作从 O(n) 降至 O(depth)
 */
export function buildParentIndex(root: MindMapNode): Record<string, string> {
  const index: Record<string, string> = { [root.id]: root.id };

  function walk(node: MindMapNode) {
    for (const child of node.children) {
      index[child.id] = node.id;
      walk(child);
    }
  }
  walk(root);
  return index;
}

/**
 * 查找节点在导图中的完整路径 (提供上层的上下文知识结构)
 * 返回从根节点到目标节点的 content 数组
 */
export function findNodePath(root: MindMapNode, targetId: string): MindMapNode[] | null {
  if (root.id === targetId) return [root];

  for (const child of root.children) {
    const path = findNodePath(child, targetId);
    if (path) {
      return [root, ...path];
    }
  }
  return null;
}

/**
 * 利用 parentIndex 以 O(depth) 查找节点路径，替代 O(n) 的 findNodePath
 */
export function findNodePathByIndex(
  root: MindMapNode,
  targetId: string,
  parentIndex: Record<string, string>,
): MindMapNode[] | null {
  if (root.id === targetId) return [root];
  if (!parentIndex[targetId]) return null;

  // Walk up from target to root using index
  const pathIds: string[] = [];
  let currentId: string | undefined = targetId;
  while (currentId && currentId !== root.id) {
    pathIds.unshift(currentId);
    currentId = parentIndex[currentId];
  }
  if (currentId !== root.id) return null; // not in this tree

  // Walk down from root collecting actual node references
  const path: MindMapNode[] = [root];
  let current = root;
  for (let i = 0; i < pathIds.length; i++) {
    const child = current.children.find((c) => c.id === pathIds[i]);
    if (!child) return null;
    path.push(child);
    current = child;
  }
  return path;
}

// ── Path-based tree mutation helpers (O(depth) node clones using parentIndex) ──

function collectPathIds(
  targetId: string,
  parentIndex: Record<string, string>,
  rootId: string,
): string[] | null {
  if (targetId === rootId) return [];
  const ids: string[] = [];
  let currentId: string | undefined = targetId;
  while (currentId && currentId !== rootId) {
    ids.unshift(currentId);
    currentId = parentIndex[currentId];
  }
  if (currentId !== rootId) return null; // not in tree
  return ids;
}

/**
 * 沿 root→target 路径克隆节点，仅 O(depth) 次克隆，非路径子树保持引用不变
 */
function clonePathNodes(
  node: MindMapNode,
  pathIds: string[],
  idx: number,
  targetId: string,
  updates?: Partial<MindMapNode>,
): MindMapNode {
  const newNode = { ...node };
  if (node.id === targetId && updates) {
    Object.assign(newNode, updates);
  }
  if (idx < pathIds.length) {
    const childId = pathIds[idx];
    newNode.children = node.children.map((child) =>
      child.id === childId ? clonePathNodes(child, pathIds, idx + 1, targetId, updates) : child,
    );
  }
  return newNode;
}

/** 利用 parentIndex 以 O(depth) 更新节点，替代 O(n) 的 updateNodeInTree */
export function updateNodeInTreeByPath(
  root: MindMapNode,
  nodeId: string,
  updates: Partial<MindMapNode>,
  parentIndex: Record<string, string>,
): MindMapNode {
  if (root.id === nodeId) return { ...root, ...updates };
  const pathIds = collectPathIds(nodeId, parentIndex, root.id);
  if (!pathIds) return root;
  return clonePathNodes(root, pathIds, 0, nodeId, updates);
}

/** 利用 parentIndex 以 O(depth) 删除节点，替代 O(n) 的 deleteNodeInTree */
export function deleteNodeInTreeByPath(
  root: MindMapNode,
  nodeId: string,
  parentIndex: Record<string, string>,
): MindMapNode | null {
  if (root.id === nodeId) return null;
  const pidList = collectPathIds(nodeId, parentIndex, root.id);
  if (!pidList) return root;

  const parentId = parentIndex[nodeId];

  function walk(node: MindMapNode, depth: number): MindMapNode {
    if (node.id === parentId) {
      return {
        ...node,
        children: node.children.filter((child) => child.id !== nodeId),
      };
    }
    if (depth >= pidList!.length) return node;
    const childId = pidList![depth];
    return {
      ...node,
      children: node.children.map((child) =>
        child.id === childId ? walk(child, depth + 1) : child,
      ),
    };
  }
  return walk(root, 0);
}

/** 利用 parentIndex 以 O(depth * n) 批量删除节点，替代 O(n) 的 deleteNodesInTree */
export function deleteNodesInTreeByPath(
  root: MindMapNode,
  nodeIds: string[],
  parentIndex: Record<string, string>,
): MindMapNode | null {
  const idsSet = new Set(nodeIds);
  if (idsSet.has(root.id)) return null;

  function walk(node: MindMapNode): MindMapNode | null {
    if (idsSet.has(node.id)) return null;
    return {
      ...node,
      children: node.children
        .map((child) => walk(child))
        .filter((child): child is MindMapNode => child !== null),
    };
  }

  // Use index to find direct parents for each deleted node to minimize traversal
  const targetsByParent = new Map<string, Set<string>>();
  for (const nid of nodeIds) {
    const pid = parentIndex[nid];
    if (pid && !idsSet.has(pid)) {
      if (!targetsByParent.has(pid)) targetsByParent.set(pid, new Set());
      targetsByParent.get(pid)!.add(nid);
    }
  }

  // If we have path info, do targeted traversal; otherwise full walk
  if (targetsByParent.size === 0) return walk(root);

  function walkPruned(node: MindMapNode): MindMapNode | null {
    if (idsSet.has(node.id)) return null;
    const targetChildren = targetsByParent.get(node.id);
    if (targetChildren) {
      return {
        ...node,
        children: node.children
          .filter((child) => !targetChildren.has(child.id))
          .map((child) => walkPruned(child))
          .filter((child): child is MindMapNode => child !== null),
      };
    }
    // Check if this node's subtree contains any deleted nodes
    const hasDeleted = node.children.some((child) => {
      let id: string | undefined = child.id;
      while (id && id !== root.id) {
        if (idsSet.has(id)) return true;
        id = parentIndex[id];
      }
      return false;
    });
    if (!hasDeleted) return node; // keep entire subtree by reference
    return {
      ...node,
      children: node.children
        .map((child) => walkPruned(child))
        .filter((child): child is MindMapNode => child !== null),
    };
  }
  return walkPruned(root);
}

/** 利用 parentIndex 以 O(depth) 追加子节点，替代 O(n) 的 appendChildrenInTree */
export function appendChildrenInTreeByPath(
  root: MindMapNode,
  parentId: string,
  newChildren: MindMapNode[],
  parentIndex: Record<string, string>,
): MindMapNode {
  if (root.id === parentId) {
    return { ...root, children: [...root.children, ...newChildren], expanded: true };
  }
  const pidList = collectPathIds(parentId, parentIndex, root.id);
  if (!pidList) return root;

  function walk(node: MindMapNode, depth: number): MindMapNode {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, ...newChildren], expanded: true };
    }
    if (depth >= pidList!.length) return node;
    const childId = pidList![depth];
    return {
      ...node,
      children: node.children.map((child) =>
        child.id === childId ? walk(child, depth + 1) : child,
      ),
    };
  }
  return walk(root, 0);
}

/** 语义去重检测：移除常见噪音词并进行模糊匹配 */
export function isSemanticDuplicate(text1: string, text2: string): boolean {
  if (!text1 || !text2) return false;

  const normalize = (s: string) => {
    return s
      .toLowerCase()
      .replace(/算法|概念|定义|简介|原理|系统|模型|方法|基础/g, "")
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "") // 移除特殊字符和空格
      .trim();
  };

  const n1 = normalize(text1);
  const n2 = normalize(text2);

  if (!n1 || !n2) return text1.trim() === text2.trim(); // 如果清理后空了，退化为严格匹配

  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

/**
 * 将 Markdown 文本解析为我们的 MindMapNode 结构
 */
import { Transformer } from "markmap-lib";
import type { INode } from "markmap-common";

/**
 * 直接将我们的导图数据转化为 Markmap 画布底层的 JSON AST
 * 这彻底绕过了不可控且耗时的 Markdown 解析器
 */
export function convertToMarkmapINode(node: MindMapNode, depth: number = 1): INode {
  const isRoot = depth === 1;
  const rootClass = isRoot ? " mindmap-root-node" : "";
  let tagsHtml = "";

  if (node.tags && node.tags.includes("explained")) {
    tagsHtml += `<span class="node-badge" title="已包含详细解释">📖</span>`;
  }

  // 核心内容安全过滤
  const safeContent = node.content && node.content.trim() ? node.content : " ";

  // 热力图色彩与 CSS 变量注入
  const progress = Math.round((node.mastery || 0) * 100);
  const nodeColor = getMasteryColor(node.mastery || 0);
  const nodeColorAlpha = getMasteryColor(node.mastery || 0, 0.4); // 进度条填充透明度更高
  const style = isRoot
    ? ""
    : `style="--node-color: ${nodeColor}; --node-progress: ${progress}%; --node-glow-color: ${nodeColorAlpha};"`;

  return {
    content: `<div data-id="${node.id}" class="mindmap-node-box${rootClass}" ${style}>
      <span class="node-content">${safeContent}</span>
      ${tagsHtml}
    </div>`,
    children: (node.children || []).map((child) => convertToMarkmapINode(child, depth + 1)),
    state: {
      fold: !node.expanded ? 1 : 0,
    },
  } as unknown as INode;
}

const transformer = new Transformer();

export function parseMarkdownToMindMapNode(markdown: string): MindMapNode {
  // Extract generated markdown (handle possible JSON or ```markdown wrappers)
  let cleanMd = markdown;
  const match = markdown.match(/```(?:markdown)?\n([\s\S]*?)```/);
  if (match) {
    cleanMd = match[1];
  }

  const { root } = transformer.transform(cleanMd);

  // Recursively map INode to MindMapNode
  function mapNode(inode: any): MindMapNode {
    // Transformer output content may contain HTML if we supplied it, or just raw text
    // Let's strip out HTML wrappers if they exist, or just use content
    const rawContent = inode.content;

    const contentText = decodeHTMLEntities(rawContent.replace(/<[^>]+>/g, "").trim());

    return {
      id: generateId(),
      content: contentText || decodeHTMLEntities(rawContent),
      depth: inode.depth || 0,
      mastery: 0,
      expanded: true,
      children: (inode.children || []).map(mapNode),
    };
  }

  // markmap puts a dummy root if there are multiple roots, or uses the first H1
  if (root.content === "" && root.children.length === 1) {
    return mapNode(root.children[0]);
  }

  return mapNode(root);
}

/**
 * 将项目导出为 JSON 字符串
 */
export function exportProjectToJSON(project: any): string {
  // 深度克隆并移除可能的循环引用或不需要的临时状态
  const data = JSON.parse(JSON.stringify(project));
  return JSON.stringify(data, null, 2);
}

/**
 * 解析并导入文件内容
 */
export async function parseImportedFile(file: File): Promise<any> {
  const content = await file.text();
  const nameSegments = file.name.split(".");
  const ext = nameSegments.pop()?.toLowerCase();

  if (ext === "json") {
    try {
      const data = JSON.parse(content);
      // 支持导入单个项目或全量备份中的第一个项目
      const projectData = Array.isArray(data.projects) ? data.projects[0] : data;

      if (!projectData || !projectData.root) {
        throw new Error("JSON 格式无效：缺失导图数据");
      }

      // 强制克隆并重置 ID，确保导入为独立副本
      const newProject = JSON.parse(JSON.stringify(projectData));
      newProject.id = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      newProject.title = `${newProject.title} (导入)`;
      newProject.createdAt = Date.now();
      newProject.updatedAt = Date.now();

      return newProject;
    } catch (e: any) {
      throw new Error(e.message || "JSON 解析失败", { cause: e });
    }
  } else if (ext === "md" || ext === "markdown") {
    const rootNode = parseMarkdownToMindMapNode(content);
    // 如果 Markdown 没有标题，使用文件名
    if (!rootNode.content || rootNode.content === "ROOT" || rootNode.content === " ") {
      rootNode.content = nameSegments.join(".");
    }

    return {
      id: `imported-${Date.now()}`,
      title: rootNode.content,
      description: "导入自 Markdown 文件",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      root: rootNode,
    };
  } else {
    throw new Error(`暂不支持 ${ext} 格式的导入`);
  }
}
