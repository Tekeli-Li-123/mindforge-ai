import { Router } from "express";
import { memoryRepo, projectRepo } from "../db/repository.js";
import type { AuthRequest } from "../middleware/auth.js";
import crypto from "node:crypto";

function getParam(p: string | string[] | undefined): string {
  return Array.isArray(p) ? p[0] : (p ?? "");
}

const router = Router();

// GET /api/projects/:projectId/memories
router.get("/:projectId/memories", (req: AuthRequest, res) => {
  const projectId = getParam(req.params.projectId);
  const project = projectRepo.getById(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const memories = memoryRepo.list(projectId);
  res.json(memories);
});

// POST /api/projects/:projectId/memories
router.post("/:projectId/memories", (req: AuthRequest, res) => {
  const projectId = getParam(req.params.projectId);
  const project = projectRepo.getById(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { fact, source } = req.body;
  if (!fact) {
    res.status(400).json({ error: "Fact is required" });
    return;
  }

  const id = crypto.randomUUID();
  memoryRepo.create({ id, projectId, fact, source });
  const memories = memoryRepo.list(projectId);
  res.status(201).json(memories);
});

// DELETE /api/memories/:id
router.delete("/memories/:id", (req: AuthRequest, res) => {
  const id = getParam(req.params.id);
  memoryRepo.delete(id);
  res.status(204).send();
});

export default router;
