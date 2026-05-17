import type { MindMapNode } from "../types/index.js";
import type { IndexChunkInput } from "../types/rag.js";
import crypto from "node:crypto";

export interface ChunkStrategy {
  /** Maximum characters per chunk. */
  maxChunkSize: number;
  /** Overlap between consecutive chunks (characters). */
  overlap: number;
}

const DEFAULT_STRATEGY: ChunkStrategy = {
  maxChunkSize: 500,
  overlap: 50,
};

/**
 * ChunkService — splits source content into manageable chunks
 * for embedding and retrieval.
 */
export const chunkService = {
  /**
   * Chunk a long text into overlapping pieces.
   * Tries to break at sentence boundaries when possible.
   */
  chunkText(text: string, strategy: ChunkStrategy = DEFAULT_STRATEGY): string[] {
    if (!text || text.length === 0) return [];
    if (text.length <= strategy.maxChunkSize) return [text];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + strategy.maxChunkSize;

      if (end >= text.length) {
        chunks.push(text.slice(start).trim());
        break;
      }

      // Try to break at a sentence boundary
      const searchEnd = end;
      const sentenceBreak = this.findSentenceBoundary(text, start, searchEnd);
      if (sentenceBreak > start + strategy.maxChunkSize * 0.3) {
        end = sentenceBreak;
      }

      chunks.push(text.slice(start, end).trim());
      start = end - strategy.overlap;
    }

    return chunks.filter((c) => c.length > 0);
  },

  /**
   * Find the best sentence boundary near the end position.
   * Returns the index of the boundary, or the fallback position.
   */
  findSentenceBoundary(text: string, minPos: number, targetPos: number): number {
    const searchStart = Math.max(minPos, targetPos - 100);
    const segment = text.slice(searchStart, targetPos + 50);

    // Priority: newline > 。！？ > .!? > ;； > ,，
    const patterns = [/\n/g, /[。！？]/g, /[.!?]/g, /[；;]/g, /[，,]/g];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      let lastMatch: number | null = null;
      const regex = new RegExp(pattern.source, "g");
      while ((match = regex.exec(segment)) !== null) {
        const pos = searchStart + match.index + 1;
        if (pos <= targetPos + 20) {
          lastMatch = pos;
        } else {
          break;
        }
      }
      if (lastMatch !== null) return lastMatch;
    }

    // Fallback: break at word boundary (space)
    const spaceIdx = text.lastIndexOf(" ", targetPos);
    if (spaceIdx > minPos) return spaceIdx;

    return targetPos;
  },

  /**
   * Extract all text content from a mind map node tree as flat chunks.
   */
  extractFromMindMap(root: MindMapNode, strategy?: ChunkStrategy): IndexChunkInput[] {
    const inputs: IndexChunkInput[] = [];
    const visited = new Set<string>();

    function traverse(node: MindMapNode) {
      if (visited.has(node.id)) return;
      visited.add(node.id);

      // Chunk the node content
      const content = node.content?.trim();
      if (content && content.length > 0) {
        const texts = chunkService.chunkText(content, strategy);
        for (const text of texts) {
          inputs.push({
            id: crypto.randomUUID(),
            projectId: "",
            sourceType: "node",
            sourceId: node.id,
            content: text,
          });
        }
      }

      // Chunk the note
      const note = node.note?.trim();
      if (note && note.length > 0) {
        const texts = chunkService.chunkText(note, strategy);
        for (const text of texts) {
          inputs.push({
            id: crypto.randomUUID(),
            projectId: "",
            sourceType: "note",
            sourceId: node.id,
            content: `[笔记] ${text}`,
          });
        }
      }

      // Chunk the explanation
      const explanation = node.explanation?.trim();
      if (explanation && explanation.length > 0) {
        const texts = chunkService.chunkText(explanation, strategy);
        for (const text of texts) {
          inputs.push({
            id: crypto.randomUUID(),
            projectId: "",
            sourceType: "node",
            sourceId: node.id,
            content: `[解释] ${text}`,
          });
        }
      }

      for (const child of node.children) {
        traverse(child);
      }
    }

    traverse(root);
    return inputs;
  },

  /**
   * Convert memories into chunk inputs.
   */
  extractFromMemories(memories: Array<{ id: string; fact: string }>): IndexChunkInput[] {
    return memories.map((m) => ({
      id: crypto.randomUUID(),
      projectId: "",
      sourceType: "memory" as const,
      sourceId: m.id,
      content: m.fact,
    }));
  },

  /**
   * Convert chat messages into chunk inputs (only user & assistant messages).
   */
  extractFromChatMessages(
    messages: Array<{ id: string; role: string; content: string }>,
  ): IndexChunkInput[] {
    const inputs: IndexChunkInput[] = [];
    for (const msg of messages) {
      if (msg.role === "system") continue;
      if (!msg.content?.trim()) continue;

      const texts = this.chunkText(msg.content, DEFAULT_STRATEGY);
      for (const text of texts) {
        inputs.push({
          id: crypto.randomUUID(),
          projectId: "",
          sourceType: "chat",
          sourceId: msg.id,
          content: `[${msg.role}] ${text}`,
        });
      }
    }
    return inputs;
  },
};
