import type { ChunkRecord, ChunkWithScore } from "../types/rag.js";

/**
 * VectorStore — an in-memory vector index for cosine similarity search.
 *
 * Chunks and their embeddings are loaded from SQLite on demand,
 * then searched in memory for fast nearest-neighbor retrieval.
 */
export class VectorStore {
  private chunks: Map<string, ChunkRecord> = new Map();
  private dimension: number = 0;
  private _loaded: boolean = false;

  get loaded(): boolean {
    return this._loaded;
  }

  get size(): number {
    return this.chunks.size;
  }

  /**
   * Load chunks with embeddings into the in-memory index.
   */
  load(chunks: ChunkRecord[]): void {
    this.chunks.clear();
    for (const chunk of chunks) {
      if (chunk.embedding) {
        this.chunks.set(chunk.id, chunk);
        const dim = Array.isArray(chunk.embedding)
          ? chunk.embedding.length
          : chunk.embedding.length;
        if (this.dimension === 0) this.dimension = dim;
      }
    }
    this._loaded = true;
  }

  /**
   * Search for the top-k most similar chunks by cosine similarity.
   */
  search(queryVector: number[], topK: number = 5): ChunkWithScore[] {
    if (this.chunks.size === 0) return [];
    if (this.dimension === 0) return [];

    const results: ChunkWithScore[] = [];

    for (const chunk of this.chunks.values()) {
      if (!chunk.embedding) continue;

      const vec = Array.isArray(chunk.embedding) ? chunk.embedding : Array.from(chunk.embedding);

      const score = cosineSimilarity(queryVector, vec);

      results.push({
        chunk: {
          id: chunk.id,
          project_id: chunk.project_id,
          source_type: chunk.source_type,
          source_id: chunk.source_id,
          content: chunk.content,
          created_at: chunk.created_at,
        },
        score,
      });
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Clear the index.
   */
  clear(): void {
    this.chunks.clear();
    this.dimension = 0;
    this._loaded = false;
  }
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (higher = more similar).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Compute L2 (Euclidean) distance between two vectors.
 * Useful for checking embedding quality.
 */
export function l2Distance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Global singleton vector store (per project indexing).
 * In production, this could be replaced with LanceDB or ChromaDB.
 */
export const globalVectorStore = new VectorStore();
