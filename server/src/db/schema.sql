-- MindForge AI — Database Schema (SQLite)
-- Run with: tsx src/db/init.ts

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  root_json TEXT NOT NULL DEFAULT '{"id":"root","content":"新思维导图","children":[],"depth":0,"mastery":0,"expanded":true}',
  ai_config_json TEXT,
  cognitive_config_json TEXT,
  cognitive_states_json TEXT DEFAULT '{}',
  memories_json TEXT DEFAULT '[]',
  is_generating INTEGER NOT NULL DEFAULT 0,
  generating_reasoning TEXT,
  generation_prompt_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_histories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  messages_json TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- RAG chunks for semantic search
CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK(source_type IN ('node','memory','chat','note')),
  source_id TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,  -- serialized Float64Array / JSON array of numbers
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_project_id ON memories(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_histories_project_id ON chat_histories(project_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_project_id ON rag_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON rag_chunks(source_type, source_id);
