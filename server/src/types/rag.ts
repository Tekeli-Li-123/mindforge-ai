// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RAG (Retrieval-Augmented Generation) Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** A chunk of text extracted from a source (mind map node, memory, chat). */
export interface ChunkRecord {
  id: string;
  project_id: string;
  source_type: "node" | "memory" | "chat" | "note";
  source_id: string; // the node ID, memory ID, etc.
  content: string;
  embedding: Float64Array | number[] | null;
  created_at: string;
}

/** Result from a similarity search. */
export interface ChunkWithScore {
  chunk: Omit<ChunkRecord, "embedding">;
  score: number;
}

/** Input for indexing a new chunk. */
export interface IndexChunkInput {
  id: string;
  projectId: string;
  sourceType: ChunkRecord["source_type"];
  sourceId: string;
  content: string;
}

/** RAG retrieval result for injection into a prompt. */
export interface RAGResult {
  contexts: string[];
  chunks: ChunkWithScore[];
  retrievalTimeMs: number;
}

/** Embedding provider configuration. */
export type EmbeddingProvider = "openai" | "local";

/** Request to embed text. */
export interface EmbeddingRequest {
  text: string;
  provider?: EmbeddingProvider;
}

/** Response from embedding service. */
export interface EmbeddingResponse {
  vector: number[];
  model: string;
}
