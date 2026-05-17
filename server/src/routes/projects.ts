import { Router } from "express";
import { projectRepo } from "../db/repository.js";
import type { AuthRequest } from "../middleware/auth.js";
import crypto from "node:crypto";

const router = Router();

// Helper: safely get string route param
function getParam(p: string | string[] | undefined): string {
  return Array.isArray(p) ? p[0] : (p ?? "");
}

// GET /api/projects — list all projects for user
router.get("/", (req: AuthRequest, res) => {
  const userId = req.userId!;
  const projects = projectRepo.list(userId);
  res.json(projects);
});

// POST /api/projects — create new project
router.post("/", (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { title, description, root, aiConfig, cognitiveConfig } = req.body;

  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const id = crypto.randomUUID();
  projectRepo.create({
    id,
    userId,
    title,
    description: description || "",
    root: root || {
      id: "root",
      content: "新思维导图",
      children: [],
      depth: 0,
      mastery: 0,
      expanded: true,
    },
    aiConfig,
    cognitiveConfig,
  });

  const project = projectRepo.getById(id);
  res.status(201).json(project);
});

// GET /api/projects/:id — get single project
router.get("/:id", (req: AuthRequest, res) => {
  const id = getParam(req.params.id);
  const project = projectRepo.getById(id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

// PUT /api/projects/:id — update project
router.put("/:id", (req: AuthRequest, res) => {
  const id = getParam(req.params.id);
  const project = projectRepo.getById(id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  projectRepo.update(id, req.body);
  const updated = projectRepo.getById(id);
  res.json(updated);
});

// DELETE /api/projects/:id — delete project
router.delete("/:id", (req: AuthRequest, res) => {
  const id = getParam(req.params.id);
  const project = projectRepo.getById(id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  projectRepo.delete(id);
  res.status(204).send();
});

export default router;
