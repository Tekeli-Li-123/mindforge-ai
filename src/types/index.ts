// ==========================================
// MindForge AI — Type Definitions
// ==========================================

/** 项目级 AI 人设配置 */
export interface ProjectAIConfig {
  /** AI 扮演的角色描述，例如 "你是一位硅谷顶尖的 AI 基础设施架构师" */
  persona: string;
  /** 解释概念时的深度风格 */
  explainStyle: 'beginner' | 'intermediate' | 'expert';
  /** 自定义的解释 prompt（可选） */
  customExplainPrompt?: string;
  /** 自定义的细化 prompt（可选） */
  customRefinePrompt?: string;
}

/** 思维导图节点 */
export interface MindMapNode {
  id: string;
  content: string;
  children: MindMapNode[];
  depth: number;
  /** 掌握度 0-1 */
  mastery: number;
  /** 是否已展开（由 AI 细化过） */
  expanded: boolean;
  /** 节点备注 */
  note?: string;
  /** 缓存保存的词条解释 */
  explanation?: string;
  /** 预留的标签记录数组，比如标记已解释或被重点标注 */
  tags?: string[];
}

/** 导图项目 */
export interface MindMapProject {
  id: string;
  title: string;
  description: string;
  root: MindMapNode;
  aiConfig?: ProjectAIConfig;
  createdAt: number;
  updatedAt: number;
}

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/** 考核题目 */
export interface QuizQuestion {
  id: string;
  type: 'choice' | 'trueFalse' | 'fillBlank';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  relatedNodeId: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

/** 考核结果 */
export interface QuizResult {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  timestamp: number;
}

/** 页面路由 */
export type PageRoute = 'dashboard' | 'editor' | 'quiz' | 'settings';
