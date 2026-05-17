import type { RAGResult, ChunkWithScore } from "../types/rag.js";
import { embeddingService } from "./EmbeddingService.js";
import { globalVectorStore, cosineSimilarity } from "./VectorStore.js";
import { ragRepo } from "../db/ragRepository.js";

export interface RetrievalConfig {
  /** Number of top chunks to retrieve. */
  topK: number;
  /** Minimum cosine similarity score to include (0–1). */
  minScore: number;
  /** Whether to include source metadata in results. */
  includeSources: boolean;
  /** Maximum characters of context to include (0 = unlimited). */
  maxContextChars: number;
}

const DEFAULT_CONFIG: RetrievalConfig = {
  topK: 5,
  minScore: 0.0,
  includeSources: true,
  maxContextChars: 8000,
};

/**
 * Retriever — semantic search over indexed chunks.
 *
 * Orchestrates: embed query → vector search → format context.
 */
export const retriever = {
  /**
   * Retrieve relevant context chunks for a query string.
   * Uses embeddings loaded into the global vector store.
   */
  async retrieve(
    query: string,
    projectId: string,
    config: Partial<RetrievalConfig> = {},
  ): Promise<RAGResult> {
    const startTime = Date.now();
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // 1. Embed the query
    const { vector } = await embeddingService.embed(query);

    // 2. Ensure vector store is loaded for this project
    if (!globalVectorStore.loaded || globalVectorStore.size === 0) {
      const chunks = ragRepo.listWithEmbeddings(projectId);
      if (chunks.length > 0) {
        globalVectorStore.load(chunks);
      }
    }

    // 3. Search
    const rawResults = globalVectorStore.search(vector, cfg.topK);

    // 4. Filter by min score
    const filtered = rawResults.filter((r) => r.score >= cfg.minScore);

    // 5. Format context strings
    const contexts: string[] = [];
    let totalChars = 0;

    for (const r of filtered) {
      let context = r.chunk.content;

      if (cfg.includeSources) {
        const sourceLabel = sourceTypeLabel(r.chunk.source_type);
        context = `[${sourceLabel}] ${context}`;
      }

      if (cfg.maxContextChars > 0 && totalChars + context.length > cfg.maxContextChars) {
        const remaining = cfg.maxContextChars - totalChars;
        if (remaining > 50) {
          contexts.push(context.slice(0, remaining));
        }
        break;
      }

      contexts.push(context);
      totalChars += context.length;
    }

    return {
      contexts,
      chunks: filtered,
      retrievalTimeMs: Date.now() - startTime,
    };
  },

  /**
   * Retrieve similar chunks using an existing vector (for RAG-on-RAG).
   */
  retrieveByVector(vector: number[], projectId: string, topK: number = 5): ChunkWithScore[] {
    if (!globalVectorStore.loaded) return [];

    // Lazy-load if not loaded
    if (globalVectorStore.size === 0) {
      const chunks = ragRepo.listWithEmbeddings(projectId);
      if (chunks.length > 0) {
        globalVectorStore.load(chunks);
      }
    }

    return globalVectorStore.search(vector, topK);
  },

  /**
   * Format retrieved contexts into a string suitable for injection into a system prompt.
   */
  formatContextForPrompt(contexts: string[]): string {
    if (contexts.length === 0) return "";

    return [
      "以下是从知识库中检索到的相关上下文：",
      "---",
      ...contexts.map((c, i) => `[${i + 1}] ${c}`),
      "---",
      "请基于以上上下文回答用户的问题。如果上下文不足以回答问题，请说明。",
    ].join("\n");
  },
};

function sourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case "node":
      return "思维导图节点";
    case "memory":
      return "记忆";
    case "chat":
      return "对话历史";
    case "note":
      return "笔记";
    default:
      return sourceType;
  }
}
