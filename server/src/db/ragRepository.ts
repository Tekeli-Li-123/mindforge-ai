import { getDb } from "./init.js";
import type { ChunkRecord, IndexChunkInput } from "../types/rag.js";

function rowToChunk(row: any): ChunkRecord {
  let embedding: Float64Array | number[] | null = null;
  if (row.embedding) {
    try {
      // Try parsing as JSON array first (number[])
      const parsed = JSON.parse(row.embedding.toString());
      embedding = Array.isArray(parsed) ? new Float64Array(parsed) : parsed;
    } catch {
      // If not JSON, assume it's already a Float64Array buffer
      embedding = new Float64Array(row.embedding);
    }
  }
  return {
    id: row.id,
    project_id: row.project_id,
    source_type: row.source_type,
    source_id: row.source_id,
    content: row.content,
    embedding,
    created_at: row.created_at,
  };
}

/** Serialize embedding vector for SQLite storage (JSON string of numbers). */
function serializeEmbedding(vec: Float64Array | number[]): string {
  return JSON.stringify(Array.from(vec));
}

export const ragRepo = {
  /** Insert a new chunk. */
  create(input: IndexChunkInput & { embedding?: Float64Array | number[] }): void {
    const db = getDb();
    db.prepare(
      `
      INSERT INTO rag_chunks (id, project_id, source_type, source_id, content, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(
      input.id,
      input.projectId,
      input.sourceType,
      input.sourceId,
      input.content,
      input.embedding ? serializeEmbedding(input.embedding) : null,
    );
  },

  /** Get all chunks for a project. */
  listByProject(projectId: string): ChunkRecord[] {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM rag_chunks WHERE project_id = ? ORDER BY created_at DESC")
      .all(projectId);
    return (rows as any[]).map(rowToChunk);
  },

  /** Get chunks by source (e.g., all chunks from a specific mind map node). */
  listBySource(projectId: string, sourceType: string, sourceId: string): ChunkRecord[] {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM rag_chunks WHERE project_id = ? AND source_type = ? AND source_id = ?",
      )
      .all(projectId, sourceType, sourceId);
    return (rows as any[]).map(rowToChunk);
  },

  /** Get all chunks that have embeddings (for vector search). */
  listWithEmbeddings(projectId: string): ChunkRecord[] {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM rag_chunks WHERE project_id = ? AND embedding IS NOT NULL")
      .all(projectId);
    return (rows as any[]).map(rowToChunk);
  },

  /** Update a chunk's embedding after generation. */
  updateEmbedding(id: string, embedding: Float64Array | number[]): void {
    const db = getDb();
    db.prepare("UPDATE rag_chunks SET embedding = ? WHERE id = ?").run(
      serializeEmbedding(embedding),
      id,
    );
  },

  /** Delete a chunk. */
  delete(id: string): void {
    const db = getDb();
    db.prepare("DELETE FROM rag_chunks WHERE id = ?").run(id);
  },

  /** Delete all chunks for a project. */
  deleteByProject(projectId: string): void {
    const db = getDb();
    db.prepare("DELETE FROM rag_chunks WHERE project_id = ?").run(projectId);
  },

  /** Delete all chunks for a specific source (e.g., re-index a node). */
  deleteBySource(projectId: string, sourceType: string, sourceId: string): void {
    const db = getDb();
    db.prepare(
      "DELETE FROM rag_chunks WHERE project_id = ? AND source_type = ? AND source_id = ?",
    ).run(projectId, sourceType, sourceId);
  },
};
