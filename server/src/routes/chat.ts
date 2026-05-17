import { Router } from "express";
import { chatRepo, projectRepo } from "../db/repository.js";
import type { AuthRequest } from "../middleware/auth.js";
import crypto from "node:crypto";

function getParam(p: string | string[] | undefined): string {
  return Array.isArray(p) ? p[0] : (p ?? "");
}

const router = Router();

// GET /api/projects/:projectId/chat — get chat history
router.get("/:projectId/chat", (req: AuthRequest, res) => {
  const projectId = getParam(req.params.projectId);
  const project = projectRepo.getById(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const chat = chatRepo.getByProject(projectId);
  res.json(chat ?? { id: "", projectId, messages: [], summary: null, createdAt: "" });
});

// POST /api/projects/:projectId/chat — save chat history
router.post("/:projectId/chat", (req: AuthRequest, res) => {
  const projectId = getParam(req.params.projectId);
  const project = projectRepo.getById(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { messages, summary } = req.body;
  if (!messages) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  const existing = chatRepo.getByProject(projectId);
  const id = existing?.id ?? crypto.randomUUID();

  chatRepo.upsert({ id, projectId, messages, summary });
  const updated = chatRepo.getByProject(projectId);
  res.json(updated);
});

export default router;
