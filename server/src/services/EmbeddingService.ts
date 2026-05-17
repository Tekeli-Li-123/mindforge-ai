import type { EmbeddingProvider, EmbeddingResponse } from "../types/rag.js";

/** Default embedding dimensions by model. */
const MODEL_DIMS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
  "BAAI/bge-small-zh-v1.5": 512,
  "all-MiniLM-L6-v2": 384,
};

/**
 * EmbeddingService — generates vector embeddings for text
 * using OpenAI's Embedding API or a local model endpoint.
 */
export const embeddingService = {
  /**
   * Generate an embedding vector for the given text.
   */
  async embed(text: string, provider?: EmbeddingProvider): Promise<EmbeddingResponse> {
    const p = provider ?? (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) ?? "openai";

    switch (p) {
      case "openai":
        return this.embedOpenAI(text);
      case "local":
        return this.embedLocal(text);
      default:
        throw new Error(`Unsupported embedding provider: ${p}`);
    }
  },

  /**
   * Generate embeddings for multiple texts in batch (OpenAI).
   */
  async embedBatch(texts: string[], provider?: EmbeddingProvider): Promise<EmbeddingResponse[]> {
    if (texts.length === 0) return [];
    const p = provider ?? (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) ?? "openai";

    switch (p) {
      case "openai":
        return this.embedOpenAIBatch(texts);
      case "local":
        // Local models typically don't support batch; fall through to sequential
        return Promise.all(texts.map((t) => this.embedLocal(t)));
      default:
        throw new Error(`Unsupported embedding provider: ${p}`);
    }
  },

  /** OpenAI embedding API. */
  async embedOpenAI(text: string): Promise<EmbeddingResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set for embeddings");

    const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI Embedding API error ${resp.status}: ${errText}`);
    }

    const data = (await resp.json()) as any;
    return {
      vector: data.data[0].embedding as number[],
      model: data.model,
    };
  },

  /** OpenAI batch embedding API (up to 2048 inputs per call). */
  async embedOpenAIBatch(texts: string[]): Promise<EmbeddingResponse[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set for embeddings");

    const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

    // Process in batches of 20
    const batchSize = 20;
    const results: EmbeddingResponse[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const resp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: batch,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`OpenAI Embedding API error ${resp.status}: ${errText}`);
      }

      const data = (await resp.json()) as any;
      for (const item of data.data) {
        results.push({
          vector: item.embedding as number[],
          model: data.model,
        });
      }
    }

    return results;
  },

  /** Local embedding endpoint (e.g., Ollama, LM Studio, text-embedding-inference). */
  async embedLocal(text: string): Promise<EmbeddingResponse> {
    const baseUrl = process.env.LOCAL_AI_URL || "http://localhost:11434";
    const model = process.env.LOCAL_EMBEDDING_MODEL || "nomic-embed-text";

    const resp = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
    });

    if (!resp.ok) {
      // Try v1/completions interface (Ollama compatible API)
      const fallbackResp = await fetch(`${baseUrl}/v1/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: text }),
      });

      if (!fallbackResp.ok) {
        const errText = await resp.text();
        throw new Error(`Local Embedding API error ${resp.status}: ${errText}`);
      }

      const data = (await fallbackResp.json()) as any;
      return {
        vector: data.data?.[0]?.embedding ?? data.embedding ?? [],
        model,
      };
    }

    const data = (await resp.json()) as any;
    return {
      vector: data.embedding ?? [],
      model,
    };
  },
};

/** Returns the expected embedding dimension for a model. */
export function getEmbeddingDim(model?: string): number {
  if (model && MODEL_DIMS[model]) return MODEL_DIMS[model];
  return 1536; // default for text-embedding-3-small
}
