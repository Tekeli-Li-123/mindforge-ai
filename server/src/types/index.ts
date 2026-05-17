export interface MindMapNode {
  id: string;
  content: string;
  children: MindMapNode[];
  depth: number;
  mastery: number;
  expanded: boolean;
  note?: string;
  explanation?: string;
  tags?: string[];
}

export interface ProjectAIConfig {
  persona: string;
  explainStyle: "beginner" | "intermediate" | "expert";
  customExplainPrompt?: string;
  customRefinePrompt?: string;
}

export type CognitivePreset = "balanced" | "theoretical" | "practical" | "exam";
export type QuizDifficulty = "easy" | "medium" | "hard";

export interface ProjectCognitiveConfig {
  preset: CognitivePreset;
  customWeights?: { recall: number; comprehension: number; application: number; analysis: number };
  defaultDifficulty?: QuizDifficulty;
}

export interface CognitiveState {
  alpha: number;
  beta: number;
  lastUpdate: number;
  evidenceHistory: EvidenceRecord[];
}

export interface EvidenceRecord {
  timestamp: number;
  question: string;
  userAnswer: string;
  llmEvidence: LLMEvidence;
  masteryBefore: number;
  masteryAfter: number;
}

export interface LLMEvidence {
  recall: number;
  comprehension: number;
  application: number;
  analysis: number;
  feedback: string;
  errorType: "factual" | "conceptual" | "logical" | "none";
  suggestion: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isCompacted?: boolean;
  reasoning?: string;
}

// Database row types
export interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  root_json: string;
  ai_config_json: string | null;
  cognitive_config_json: string | null;
  cognitive_states_json: string | null;
  memories_json: string | null;
  is_generating: number;
  generating_reasoning: string | null;
  generation_prompt_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryRow {
  id: string;
  project_id: string;
  fact: string;
  source: string;
  created_at: string;
}

export interface ChatHistoryRow {
  id: string;
  project_id: string;
  messages_json: string;
  summary: string | null;
  created_at: string;
}

export interface AIProxyRequest {
  provider: "openai" | "anthropic" | "deepseek" | "local";
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIProxyResponse {
  content: string;
  reasoning?: string;
}
