// ==========================================
// MindForge AI — Type Definitions
// ==========================================

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
