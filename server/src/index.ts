import express from "express";
import cors from "cors";
import { initDatabase } from "./db/init.js";
import { authMiddleware } from "./middleware/auth.js";
import projectRoutes from "./routes/projects.js";
import memoryRoutes from "./routes/memories.js";
import chatRoutes from "./routes/chat.js";
import aiProxyRoutes from "./routes/aiProxy.js";
import ragRoutes from "./routes/rag.js";

// Initialize database on startup
initDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check (no auth)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth-protected routes
app.use("/api/projects", authMiddleware, projectRoutes);
app.use("/api/projects", authMiddleware, memoryRoutes);
app.use("/api/projects", authMiddleware, chatRoutes);
app.use("/api", authMiddleware, aiProxyRoutes);
app.use("/api/rag", authMiddleware, ragRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🧠 MindForge Server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});

export default app;
