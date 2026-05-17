import { Router, type Request, type Response } from "express";
import { projectRepo } from "../db/repository.js";
import { chatRepo } from "../db/repository.js";
import { memoryRepo } from "../db/repository.js";
import { ragPipeline } from "../services/RAGPipeline.js";

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

const router = Router();

/**
 * POST /api/rag/reindex/:projectId
 * Full re-index of a project (mind map + memories + chat history).
 */
router.post("/reindex/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");
    const project = projectRepo.getById(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Gather sources
    const memories = memoryRepo.list(projectId).map((m) => ({ id: m.id, fact: m.fact }));
    const chatHistory = chatRepo.getByProject(projectId);
    const chatMessages = chatHistory?.messages ?? [];

    const result = await ragPipeline.reindexProject(
      projectId,
      project.root,
      memories,
      chatMessages,
    );

    res.json({
      success: true,
      ...result,
      projectId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rag/query/:projectId
 * Query the RAG system for relevant context.
 * Body: { query: string, topK?: number, minScore?: number }
 */
router.post("/query/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");
    const { query, topK, minScore, maxContextChars } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Query text is required" });
      return;
    }

    const result = await ragPipeline.retrieve(query, projectId, {
      topK: topK ?? 5,
      minScore: minScore ?? 0.0,
      maxContextChars: maxContextChars ?? 8000,
    });

    res.json({ ...result, query });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rag/query-formatted/:projectId
 * Same as query, but returns context already formatted for prompt injection.
 * Ideal for use by the AI proxy.
 */
router.post("/query-formatted/:projectId", async (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");
    const { query, topK, minScore } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Query text is required" });
      return;
    }

    const { contextPrompt, debug } = await ragPipeline.retrieveAndFormat(query, projectId, {
      topK: topK ?? 5,
      minScore: minScore ?? 0.0,
    });

    res.json({ contextPrompt, debug, query });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rag/stats/:projectId
 * Get indexing statistics for a project.
 */
router.get("/stats/:projectId", (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");
    const stats = ragPipeline.getStats(projectId);
    res.json({ projectId, ...stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rag/remove/:projectId
 * Remove indexed chunks for a specific source.
 * Body: { sourceType: string, sourceId: string }
 */
router.post("/remove/:projectId", (req: Request, res: Response) => {
  try {
    const projectId = getParam(req, "projectId");
    const { sourceType, sourceId } = req.body;

    if (!sourceType || !sourceId) {
      res.status(400).json({ error: "sourceType and sourceId are required" });
      return;
    }

    ragPipeline.removeFromIndex(projectId, sourceType, sourceId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
