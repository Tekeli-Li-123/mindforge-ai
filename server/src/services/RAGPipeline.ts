import type { MindMapNode, ChatMessage } from "../types/index.js";
import type { RAGResult, IndexChunkInput, ChunkWithScore } from "../types/rag.js";
import { ragRepo } from "../db/ragRepository.js";
import { chunkService } from "./ChunkService.js";
import { embeddingService } from "./EmbeddingService.js";
import { retriever, type RetrievalConfig } from "./Retriever.js";
import { globalVectorStore } from "./VectorStore.js";
import crypto from "node:crypto";

/**
 * RAGPipeline — the top-level orchestrator for indexing and retrieval.
 *
 * Responsibilities:
 * 1. Index mind map nodes, memories, and chat history into chunks + embeddings
 * 2. Run semantic retrieval on user queries
 * 3. Inject retrieved context into AI prompts
 */
export const ragPipeline = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Indexing
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Full re-index of a project: clear existing indexed chunks,
   * re-extract from root mind map + memories + chat history,
   * compute embeddings, and reload the vector store.
   *
   * This is the main entry point called after a mind map update.
   */
  async reindexProject(
    projectId: string,
    root: MindMapNode,
    memories: Array<{ id: string; fact: string }>,
    chatMessages: ChatMessage[],
  ): Promise<{ chunksIndexed: number; timeMs: number }> {
    const startTime = Date.now();

    // 1. Delete all existing chunks for this project
    ragRepo.deleteByProject(projectId);

    // 2. Extract chunks from all sources
    const nodeChunks = chunkService.extractFromMindMap(root);
    const memoryChunks = chunkService.extractFromMemories(memories);
    const chatChunks = chunkService.extractFromChatMessages(chatMessages);

    const allInputs: IndexChunkInput[] = [...nodeChunks, ...memoryChunks, ...chatChunks];

    if (allInputs.length === 0) return { chunksIndexed: 0, timeMs: Date.now() - startTime };

    // Set project ID on all inputs
    for (const input of allInputs) {
      input.projectId = projectId;
    }

    // 3. Compute embeddings in batch
    const texts = allInputs.map((i) => i.content);
    const embeddings = await embeddingService.embedBatch(texts);

    // 4. Save chunks to DB with embeddings
    const chunkRecords: Array<IndexChunkInput & { embedding: number[] }> = [];
    for (let i = 0; i < allInputs.length; i++) {
      const input = allInputs[i];
      const emb = embeddings[i];
      if (!emb) continue;

      ragRepo.create({
        ...input,
        embedding: emb.vector,
      });

      chunkRecords.push({ ...input, embedding: emb.vector });
    }

    // 5. Reload vector store
    const dbChunks = ragRepo.listWithEmbeddings(projectId);
    globalVectorStore.load(dbChunks);

    return {
      chunksIndexed: chunkRecords.length,
      timeMs: Date.now() - startTime,
    };
  },

  /**
   * Incrementally index new content without clearing existing chunks.
   * Useful after adding a single node or saving a chat message.
   */
  async indexIncremental(
    projectId: string,
    inputs: IndexChunkInput[],
  ): Promise<{ chunksIndexed: number }> {
    if (inputs.length === 0) return { chunksIndexed: 0 };

    // Set project ID
    for (const input of inputs) {
      input.projectId = projectId;
    }

    // Compute embeddings
    const texts = inputs.map((i) => i.content);
    const embeddings = await embeddingService.embedBatch(texts);

    // Save each chunk
    let count = 0;
    for (let i = 0; i < inputs.length; i++) {
      const emb = embeddings[i];
      if (!emb) continue;

      ragRepo.create({
        ...inputs[i],
        embedding: emb.vector,
      });
      count++;
    }

    // Reload vector store
    const dbChunks = ragRepo.listWithEmbeddings(projectId);
    globalVectorStore.load(dbChunks);

    return { chunksIndexed: count };
  },

  /**
   * Remove indexed chunks for a specific source (e.g., a deleted node).
   */
  removeFromIndex(projectId: string, sourceType: string, sourceId: string): void {
    ragRepo.deleteBySource(projectId, sourceType, sourceId);

    // Reload vector store
    const dbChunks = ragRepo.listWithEmbeddings(projectId);
    globalVectorStore.load(dbChunks);
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Retrieval
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Retrieve relevant context for a user query.
   */
  async retrieve(
    query: string,
    projectId: string,
    config?: Partial<RetrievalConfig>,
  ): Promise<RAGResult> {
    return retriever.retrieve(query, projectId, config);
  },

  /**
   * Format retrieved context into a system prompt supplement.
   */
  formatContextForPrompt(contexts: string[]): string {
    return retriever.formatContextForPrompt(contexts);
  },

  /**
   * One-shot: retrieve + format in a single call, ready to inject into an AI prompt.
   * Returns the context string plus the raw result for debugging.
   */
  async retrieveAndFormat(
    query: string,
    projectId: string,
    config?: Partial<RetrievalConfig>,
  ): Promise<{ contextPrompt: string; debug: RAGResult }> {
    const result = await this.retrieve(query, projectId, config);
    const contextPrompt = this.formatContextForPrompt(result.contexts);
    return { contextPrompt, debug: result };
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Utility
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get index statistics for a project.
   */
  getStats(projectId: string): {
    totalChunks: number;
    indexedChunks: number;
    sourceBreakdown: Record<string, number>;
  } {
    const allChunks = ragRepo.listByProject(projectId);
    const indexedChunks = ragRepo.listWithEmbeddings(projectId);

    const sourceBreakdown: Record<string, number> = {};
    for (const chunk of allChunks) {
      sourceBreakdown[chunk.source_type] = (sourceBreakdown[chunk.source_type] || 0) + 1;
    }

    return {
      totalChunks: allChunks.length,
      indexedChunks: indexedChunks.length,
      sourceBreakdown,
    };
  },
};
