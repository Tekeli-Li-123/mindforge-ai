// ==========================================
// MindForge AI — Type Definitions
// ==========================================

export const TYPE_SYSTEM_VERSION = '1.1.0';

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

/** 贝叶斯评估预设类型 */
export type CognitivePreset = 'balanced' | 'theoretical' | 'practical' | 'exam';

/** 考核难度级别 */
export type QuizDifficulty = 'easy' | 'medium' | 'hard';

/** 认知评估权重配置 */
export interface CognitiveWeightConfig {
  recall: number;
  comprehension: number;
  application: number;
  analysis: number;
}

/** LLM 提取的证据格式 */
export interface LLMEvidence {
  /** 能否准确回忆核心定义/事实 (0-1) */
  recall: number;
  /** 能否用自己的话解释清楚 (0-1) */
  comprehension: number;
  /** 能否举例或关联实际场景 (0-1) */
  application: number;
  /** 能否辨析易混点或批判性思考 (0-1) */
  analysis: number;
  
  /** LLM 给出的定性评估反馈 */
  feedback: string;
  /** 错误类型 */
  errorType: 'factual' | 'conceptual' | 'logical' | 'none';
  /** 针对性的学习建议 */
  suggestion: string;
}

/** 单次证据记录 */
export interface EvidenceRecord {
  timestamp: number;
  question: string;
  userAnswer: string;
  llmEvidence: LLMEvidence;
  masteryBefore: number;
  masteryAfter: number;
}

/** 节点认知状态（贝叶斯 Beta 分布参数） */
export interface CognitiveState {
  /** 成功权重累加值 */
  alpha: number;
  /** 失败权重累加值 */
  beta: number;
  /** 最后更新时间 */
  lastUpdate: number;
  /** 历史证据记录 */
  evidenceHistory: EvidenceRecord[];
}

/** 导图项目级认知配置 */
export interface ProjectCognitiveConfig {
  preset: CognitivePreset;
  customWeights?: CognitiveWeightConfig;
  defaultDifficulty?: QuizDifficulty;
}

/** 思维导图节点 */
export interface MindMapNode {
  id: string;
  content: string;
  children: MindMapNode[];
  depth: number;
  /** 掌握度 0-1 (映射自认知状态的期望值) */
  mastery: number;
  /** 是否已展开（由 AI 细化过） */
  expanded: boolean;
  /** 节点备注 */
  note?: string;
  /** 缓存保存的词条解释 */
  explanation?: string;
  /** 预留的标签记录数组 */
  tags?: string[];
}

/** 导图项目 */
export interface MindMapProject {
  id: string;
  title: string;
  description: string;
  root: MindMapNode;
  aiConfig?: ProjectAIConfig;
  /** 认知评估配置 */
  cognitiveConfig?: ProjectCognitiveConfig;
  /** 节点 ID 到认知状态的映射 */
  cognitiveStates?: Record<string, CognitiveState>;
  createdAt: number;
  updatedAt: number;
  /** 长期记忆 */
  memories?: string[];
  /** 是否正在生成中（流式） */
  isGenerating?: boolean;
  /** 流式生成期间积累的思考内容 */
  generatingReasoning?: string;
  /** 用于重启/继续生成的初始参数 */
  generationPrompt?: {
    prompt: string;
    title?: string;
    description?: string;
  };
}

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isCompacted?: boolean;
  /** AI 推理/思维过程（可选，来自推理模型的 thinking/reasoning 输出） */
  reasoning?: string;
}

/** 考核题目 */
export interface QuizQuestion {
  id: string;
  type: 'choice' | 'trueFalse' | 'fillBlank' | 'openEnded';
  question: string;
  options?: string[];
  correctAnswer?: string;
  referenceAnswer?: string;
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
  evidence?: LLMEvidence;
}

/** 页面路由 */
export type PageRoute = 'dashboard' | 'editor' | 'quiz' | 'settings';
