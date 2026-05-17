import type { Request, Response, NextFunction } from "express";

// Simple token-based auth for development.
// In production, replace with JWT verification using jsonwebtoken.
const API_TOKEN = process.env.MINDFORGE_API_TOKEN || "dev-token";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  if (token !== API_TOKEN) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  // In a real app, decode JWT and extract userId from payload.
  // For now, use a default user ID for development.
  req.userId = (req.headers["x-user-id"] as string) || "default-user";
  next();
}
