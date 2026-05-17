import { getDb } from "./init.js";
import type {
  MindMapNode,
  ProjectAIConfig,
  ProjectCognitiveConfig,
  CognitiveState,
  ChatMessage,
} from "../types/index.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Project Repository
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ProjectRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  root: MindMapNode;
  aiConfig: ProjectAIConfig | null;
  cognitiveConfig: ProjectCognitiveConfig | null;
  cognitiveStates: Record<string, CognitiveState>;
  memories: string[];
  isGenerating: boolean;
  generatingReasoning: string | null;
  generationPrompt: { prompt: string; title?: string; description?: string } | null;
  createdAt: string;
  updatedAt: string;
}

function rowToProject(row: any): ProjectRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    root: JSON.parse(row.root_json),
    aiConfig: row.ai_config_json ? JSON.parse(row.ai_config_json) : null,
    cognitiveConfig: row.cognitive_config_json ? JSON.parse(row.cognitive_config_json) : null,
    cognitiveStates: row.cognitive_states_json ? JSON.parse(row.cognitive_states_json) : {},
    memories: row.memories_json ? JSON.parse(row.memories_json) : [],
    isGenerating: row.is_generating === 1,
    generatingReasoning: row.generating_reasoning,
    generationPrompt: row.generation_prompt_json ? JSON.parse(row.generation_prompt_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const projectRepo = {
  list(userId: string): ProjectRecord[] {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC")
      .all(userId);
    return rows.map(rowToProject);
  },

  getById(id: string): ProjectRecord | null {
    const db = getDb();
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
    return row ? rowToProject(row) : null;
  },

  create(project: {
    id: string;
    userId: string;
    title: string;
    description: string;
    root: MindMapNode;
    aiConfig?: ProjectAIConfig;
    cognitiveConfig?: ProjectCognitiveConfig;
  }): void {
    const db = getDb();
    db.prepare(
      `
      INSERT INTO projects (id, user_id, title, description, root_json, ai_config_json, cognitive_config_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      project.id,
      project.userId,
      project.title,
      project.description,
      JSON.stringify(project.root),
      project.aiConfig ? JSON.stringify(project.aiConfig) : null,
      project.cognitiveConfig ? JSON.stringify(project.cognitiveConfig) : null,
    );
  },

  update(
    id: string,
    updates: {
      title?: string;
      description?: string;
      root?: MindMapNode;
      aiConfig?: ProjectAIConfig | null;
      cognitiveConfig?: ProjectCognitiveConfig | null;
      cognitiveStates?: Record<string, CognitiveState>;
      memories?: string[];
      isGenerating?: boolean;
      generatingReasoning?: string | null;
      generationPrompt?: object | null;
    },
  ): void {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push("title = ?");
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }
    if (updates.root !== undefined) {
      fields.push("root_json = ?");
      values.push(JSON.stringify(updates.root));
    }
    if (updates.aiConfig !== undefined) {
      fields.push("ai_config_json = ?");
      values.push(updates.aiConfig ? JSON.stringify(updates.aiConfig) : null);
    }
    if (updates.cognitiveConfig !== undefined) {
      fields.push("cognitive_config_json = ?");
      values.push(updates.cognitiveConfig ? JSON.stringify(updates.cognitiveConfig) : null);
    }
    if (updates.cognitiveStates !== undefined) {
      fields.push("cognitive_states_json = ?");
      values.push(JSON.stringify(updates.cognitiveStates));
    }
    if (updates.memories !== undefined) {
      fields.push("memories_json = ?");
      values.push(JSON.stringify(updates.memories));
    }
    if (updates.isGenerating !== undefined) {
      fields.push("is_generating = ?");
      values.push(updates.isGenerating ? 1 : 0);
    }
    if (updates.generatingReasoning !== undefined) {
      fields.push("generating_reasoning = ?");
      values.push(updates.generatingReasoning);
    }
    if (updates.generationPrompt !== undefined) {
      fields.push("generation_prompt_json = ?");
      values.push(updates.generationPrompt ? JSON.stringify(updates.generationPrompt) : null);
    }

    if (fields.length === 0) return;

    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },

  delete(id: string): void {
    const db = getDb();
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Memory Repository
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MemoryRecord {
  id: string;
  projectId: string;
  fact: string;
  source: string;
  createdAt: string;
}

export const memoryRepo = {
  list(projectId: string): MemoryRecord[] {
    const db = getDb();
    return db
      .prepare("SELECT * FROM memories WHERE project_id = ? ORDER BY created_at DESC")
      .all(projectId) as MemoryRecord[];
  },

  create(memory: { id: string; projectId: string; fact: string; source?: string }): void {
    const db = getDb();
    db.prepare("INSERT INTO memories (id, project_id, fact, source) VALUES (?, ?, ?, ?)").run(
      memory.id,
      memory.projectId,
      memory.fact,
      memory.source ?? "manual",
    );
  },

  delete(id: string): void {
    const db = getDb();
    db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Chat History Repository
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ChatHistoryRecord {
  id: string;
  projectId: string;
  messages: ChatMessage[];
  summary: string | null;
  createdAt: string;
}

export const chatRepo = {
  getByProject(projectId: string): ChatHistoryRecord | null {
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM chat_histories WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(projectId) as any;
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      messages: JSON.parse(row.messages_json),
      summary: row.summary,
      createdAt: row.created_at,
    };
  },

  upsert(chat: { id: string; projectId: string; messages: ChatMessage[]; summary?: string }): void {
    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM chat_histories WHERE project_id = ?")
      .get(chat.projectId) as any;
    if (existing) {
      db.prepare(
        "UPDATE chat_histories SET messages_json = ?, summary = ? WHERE project_id = ?",
      ).run(JSON.stringify(chat.messages), chat.summary ?? null, chat.projectId);
    } else {
      db.prepare(
        "INSERT INTO chat_histories (id, project_id, messages_json, summary) VALUES (?, ?, ?, ?)",
      ).run(chat.id, chat.projectId, JSON.stringify(chat.messages), chat.summary ?? null);
    }
  },

  delete(projectId: string): void {
    const db = getDb();
    db.prepare("DELETE FROM chat_histories WHERE project_id = ?").run(projectId);
  },
};
