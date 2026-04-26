import type { CognitiveState, LLMEvidence, CognitiveWeightConfig, CognitivePreset, EvidenceRecord } from '../types';

/**
 * 贝叶斯评估预设权重定义
 */
export const ASSESSMENT_PRESETS: Record<CognitivePreset, CognitiveWeightConfig> = {
  balanced: {
    recall: 1.0,
    comprehension: 2.0,
    application: 1.5,
    analysis: 1.0,
  },
  theoretical: {
    recall: 0.8,
    comprehension: 2.5,
    application: 1.0,
    analysis: 2.0,
  },
  practical: {
    recall: 1.0,
    comprehension: 1.5,
    application: 3.0,
    analysis: 1.0,
  },
  exam: {
    recall: 2.5,
    comprehension: 2.0,
    application: 1.0,
    analysis: 0.5,
  },
};

/**
 * 初始先验状态 (Deep Skeptic Prior: alpha=1, beta=19 => 5% Mastery)
 */
export const INITIAL_COGNITIVE_STATE: CognitiveState = {
  alpha: 2,
  beta: 8,
  lastUpdate: Date.now(),
  evidenceHistory: [],
};

/**
 * 更新节点认知状态 (Beta-Bernoulli 共轭更新)
 * 
 * 公式:
 * S = sum(w_i * e_i)
 * N = sum(w_i)
 * alpha_new = alpha_old + S
 * beta_new = beta_old + (N - S)
 * 
 * @param currentState 当前认知状态
 * @param evidence LLM 提取的四维证据
 * @param weights 权重配置
 * @param metadata 附加信息 (题目、答案等)
 */
export function updateCognitiveState(
  currentState: CognitiveState,
  evidence: LLMEvidence & { question?: string; userAnswer?: string },
  weights: CognitiveWeightConfig = ASSESSMENT_PRESETS.balanced
): { newState: CognitiveState; masteryBefore: number; masteryAfter: number } {
  const { recall, comprehension, application, analysis, question = '', userAnswer = '' } = evidence;
  
  // 1. 计算加权成功次数 (S) 和总尝试次数 (N)
  const S = 
    recall * weights.recall +
    comprehension * weights.comprehension +
    application * weights.application +
    analysis * weights.analysis;
  
  const N = 
    weights.recall +
    weights.comprehension +
    weights.application +
    weights.analysis;

  // 2. 计算后验参数
  const newAlpha = currentState.alpha + S;
  const newBeta = currentState.beta + (N - S);

  // 3. 计算掌握度变化 (期望值 E[X] = alpha / (alpha + beta))
  const masteryBefore = calculateMastery(currentState.alpha, currentState.beta);
  const masteryAfter = calculateMastery(newAlpha, newBeta);

  // 4. 构建证据记录
  const record: EvidenceRecord = {
    timestamp: Date.now(),
    question,
    userAnswer,
    llmEvidence: evidence,
    masteryBefore,
    masteryAfter,
  };

  const newState: CognitiveState = {
    alpha: newAlpha,
    beta: newBeta,
    lastUpdate: Date.now(),
    evidenceHistory: [...currentState.evidenceHistory, record],
  };

  return { newState, masteryBefore, masteryAfter };
}

/**
 * 计算 Beta 分布的概率期望值
 */
export function calculateMastery(alpha: number, beta: number): number {
  if (alpha + beta === 0) return 0.5; // 不应发生
  return alpha / (alpha + beta);
}

/**
 * 为非百科问答类题目（选择、判断）映射代理证据
 */
export function calculateProxyEvidence(
  isCorrect: boolean,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): LLMEvidence {
  const diffMultiplier = difficulty === 'hard' ? 1.2 : difficulty === 'easy' ? 0.8 : 1.0;
  
  if (isCorrect) {
    return {
      recall: Math.min(1, 0.9 * diffMultiplier),
      comprehension: Math.min(1, 0.7 * diffMultiplier),
      application: Math.min(1, 0.6 * diffMultiplier),
      analysis: Math.min(1, 0.5 * diffMultiplier),
      feedback: '回答正确！展示了良好的知识掌握。',
      errorType: 'none',
      suggestion: '继续保持，可以尝试更高难度的挑战。'
    };
  } else {
    return {
      recall: 0.3,
      comprehension: 0.2,
      application: 0.1,
      analysis: 0.1,
      feedback: '回答错误。这个观点还需要再加强学习。',
      errorType: 'conceptual',
      suggestion: '建议针对该知识点的定义和基础应用进行复习。'
    };
  }
}

/**
 * 格式化掌握度为百分比整数
 */
export function formatMasteryPercentage(mastery: number): number {
  return Math.round(mastery * 100);
}
