import type { MindMapNode } from '../types';

/** 将包含 HTML 实体（如 &#x786c;）的字符串还原为正常字符 */
export function decodeHTMLEntities(text: string): string {
  if (!text) return '';
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
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

/** 根据掌握度获取颜色 */
export function getMasteryColor(mastery: number): string {
  if (mastery >= 0.8) return 'var(--color-mastery-full)';
  if (mastery >= 0.6) return 'var(--color-mastery-high)';
  if (mastery >= 0.3) return 'var(--color-mastery-medium)';
  if (mastery > 0) return 'var(--color-mastery-low)';
  return 'var(--color-mastery-none)';
}

/** 根据掌握度获取标签 */
export function getMasteryLabel(mastery: number): string {
  if (mastery >= 0.8) return '精通';
  if (mastery >= 0.6) return '熟练';
  if (mastery >= 0.3) return '了解';
  if (mastery > 0) return '入门';
  return '未学';
}

/** 扁平化导图节点 */
export function flattenNodes(node: MindMapNode): MindMapNode[] {
  return [node, ...node.children.flatMap(flattenNodes)];
}

/**
 * 将 MindMapNode 转为 Markdown（用于 markmap 或 AI prompt）
 * @param forAI 如果为 true，则产出纯净的文本格式给 AI；否则注入用于 UI 的额外 DOM（如标签等）
 */
export function nodeToMarkdown(node: MindMapNode, level: number = 1, forAI: boolean = false): string {
  const prefix = level <= 4 ? '#'.repeat(level) + ' ' : '- ';
  
  if (forAI) {
    let md = `${prefix}${node.content}\n`;
    for (const child of node.children) {
      md += nodeToMarkdown(child, level + 1, true);
    }
    return md;
  }

  const rootClass = level === 1 ? ' mindmap-root-node' : '';
  let tagsHtml = '';
  
  if (node.tags && node.tags.includes('explained')) {
    tagsHtml += `<span class="node-badge" title="已包含详细解释">📖</span>`;
  }
  
  let md = `${prefix}<div data-id="${node.id}" class="mindmap-node-box${rootClass}">${node.content}${tagsHtml}</div>\n`;
  for (const child of node.children) {
    md += nodeToMarkdown(child, level + 1, false);
  }
  return md;
}

/**
 * 查找节点在导图中的完整路径 (提供上层的上下文知识结构)
 * 返回从根节点到目标节点的 content 数组
 */
export function findNodePath(root: MindMapNode, targetId: string): string[] | null {
  if (root.id === targetId) return [root.content];
  
  for (const child of root.children) {
    const path = findNodePath(child, targetId);
    if (path) {
      return [root.content, ...path];
    }
  }
  return null;
}

/**
 * 将 Markdown 文本解析为我们的 MindMapNode 结构
 */
import { Transformer } from 'markmap-lib';
import type { INode } from 'markmap-common';

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
  function mapNode(inode: INode): MindMapNode {
    // Transformer output content may contain HTML if we supplied it, or just raw text
    // Let's strip out HTML wrappers if they exist, or just use content
    const rawContent = inode.content;
    
    const contentText = decodeHTMLEntities(rawContent.replace(/<[^>]+>/g, '').trim());

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
  if (root.content === '' && root.children.length === 1) {
    return mapNode(root.children[0]);
  }

  return mapNode(root);
}
