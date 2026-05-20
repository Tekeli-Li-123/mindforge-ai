import type {
  CognitiveState,
  LLMEvidence,
  CognitiveWeightConfig,
  CognitivePreset,
  EvidenceRecord,
  ConfidenceInterval,
} from "../types";

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
 * 初始先验状态 (Deep Skeptic Prior: 20% Mastery, 中等置信)
 * Alpha=2, beta=8 => 期望 20%，等效于 10 次尝试的证据
 */
export const INITIAL_COGNITIVE_STATE: CognitiveState = {
  alpha: 2,
  beta: 8,
  lastUpdate: Date.now(),
  evidenceHistory: [],
  forgettingHalfLife: 168, // 7 天
};

/**
 * 正态分布分位数近似 (Abramowitz-Stiegler, for CI95)
 * 用于计算 Beta 分布 95% 置信区间
 */
function normQuantile(p: number): number {
  // 只需 0.025 和 0.975 对应的分位数: ±1.96
  if (p < 0.5) return -1.96;
  return 1.96;
}

/**
 * 计算 Beta(alpha, beta) 的 95% 置信区间
 * 使用正态近似 (大样本时准确，小样本时保守)
 */
export function calculateConfidenceInterval(alpha: number, beta: number): ConfidenceInterval {
  const n = alpha + beta;
  if (n === 0) {
    return { lower: 0, upper: 1, evidenceCount: 0 };
  }

  const mu = alpha / n;
  // Beta 分布方差 = alpha * beta / (n^2 * (n + 1))
  const variance = (alpha * beta) / (n * n * (n + 1));
  const std = Math.sqrt(variance);
  const z = normQuantile(0.975); // 1.96

  const lower = Math.max(0, mu - z * std);
  const upper = Math.min(1, mu + z * std);

  return { lower, upper, evidenceCount: n };
}

/**
 * 根据遗忘曲线计算衰减后的有效 α/β
 *
 * 公式: decay = minDecay + (1 - minDecay) * 2^(-elapsed / halfLife)
 * 有效 alpha = alpha * decay, 有效 beta = beta * decay
 *
 * 这相当于：随时间的增长，观察到的证据权重逐渐趋向中立，但不会完全归零。
 *
 * @param state 原始认知状态
 * @param now 当前时间戳（ms）
 * @param minDecay 最小衰减系数（>=0, <=1）
 */
export function applyForgettingCurve(
  state: CognitiveState,
  now: number = Date.now(),
  minDecay: number = 0.3,
): { effectiveAlpha: number; effectiveBeta: number; decayFactor: number } {
  const halfLifeMs = (state.forgettingHalfLife ?? 168) * 3600 * 1000; // 小时转 ms
  const elapsed = now - state.lastUpdate;

  // 如果还不到半衰期或没有记录，不衰减
  if (elapsed <= 0 || halfLifeMs <= 0) {
    return { effectiveAlpha: state.alpha, effectiveBeta: state.beta, decayFactor: 1 };
  }

  // 衰减系数: minDecay + (1 - minDecay) * 2^(-elapsed/halfLife)
  const decayFactor = minDecay + (1 - minDecay) * Math.pow(2, -elapsed / halfLifeMs);

  return {
    effectiveAlpha: state.alpha * decayFactor,
    effectiveBeta: state.beta * decayFactor,
    decayFactor,
  };
}

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
  weights: CognitiveWeightConfig = ASSESSMENT_PRESETS.balanced,
): { newState: CognitiveState; masteryBefore: number; masteryAfter: number } {
  const { recall, comprehension, application, analysis, question = "", userAnswer = "" } = evidence;

  // 1. 先应用遗忘曲线，衰减旧证据权重
  const forgetting = applyForgettingCurve(currentState);
  const baseAlpha = forgetting.effectiveAlpha;
  const baseBeta = forgetting.effectiveBeta;

  // 2. 计算加权成功次数 (S) 和总尝试次数 (N)
  const S =
    recall * weights.recall +
    comprehension * weights.comprehension +
    application * weights.application +
    analysis * weights.analysis;

  const N = weights.recall + weights.comprehension + weights.application + weights.analysis;

  // 3. 计算后验参数
  const newAlpha = baseAlpha + S;
  const newBeta = baseBeta + (N - S);

  // 4. 计算掌握度变化 (期望值 E[X] = alpha / (alpha + beta))
  const masteryBefore = calculateMastery(baseAlpha, baseBeta);
  const masteryAfter = calculateMastery(newAlpha, newBeta);

  // 5. 计算置信区间
  const ci = calculateConfidenceInterval(newAlpha, newBeta);

  // 6. 构建证据记录
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
    confidenceInterval: ci,
    forgettingHalfLife: currentState.forgettingHalfLife,
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
 * 计算掌握度的贝叶斯置信区间（以文字描述）
 */
export function describeMastery(alpha: number, beta: number): string {
  const mastery = calculateMastery(alpha, beta);
  const ci = calculateConfidenceInterval(alpha, beta);
  const percentage = Math.round(mastery * 100);
  const range = `${Math.round(ci.lower * 100)}%-${Math.round(ci.upper * 100)}%`;
  const level =
    ci.evidenceCount < 5 ? "低置信度" : ci.evidenceCount < 20 ? "中等置信度" : "高置信度";
  return `${percentage}% [${range}, ${level}, n=${ci.evidenceCount}]`;
}

/**
 * 为非百科问答类题目（选择、判断）映射代理证据
 *
 * 改进：基于是否正确定级映射，对于选择题还考虑蒙对的概率因子
 */
export function calculateProxyEvidence(
  isCorrect: boolean,
  difficulty: "easy" | "medium" | "hard" = "medium",
  isMultipleChoice: boolean = false,
): LLMEvidence {
  const diffMultiplier = difficulty === "hard" ? 1.2 : difficulty === "easy" ? 0.8 : 1.0;

  if (isCorrect) {
    // 选择题蒙对概率高，所以降低 recall 和 comprehension 的置信度
    const guessFactor = isMultipleChoice ? 0.95 : 1.0;

    return {
      recall: Math.min(1, 0.85 * diffMultiplier * guessFactor),
      comprehension: Math.min(1, 0.65 * diffMultiplier * guessFactor),
      application: Math.min(1, 0.55 * diffMultiplier * guessFactor),
      analysis: Math.min(1, 0.45 * diffMultiplier),
      feedback: "回答正确！展现了良好的知识掌握。",
      errorType: "none",
      suggestion: "继续保持，可以尝试更高难度的挑战。",
    };
  } else {
    // 答错时按难度梯度：easy 题答错 → 更低分数（更严重的证据）
    const wrongScale = difficulty === "hard" ? 0.5 : difficulty === "easy" ? 0.15 : 0.25;

    return {
      recall: wrongScale,
      comprehension: wrongScale * 0.8,
      application: wrongScale * 0.6,
      analysis: wrongScale * 0.5,
      feedback: "回答错误。这个知识点还需要加强学习。",
      errorType: difficulty === "hard" ? "conceptual" : "factual",
      suggestion:
        difficulty === "hard"
          ? "建议深入理解概念的本质，多做一些综合性练习。"
          : "建议回顾相关基础知识，确保掌握核心定义。",
    };
  }
}

/**
 * 格式化掌握度为百分比整数
 */
export function formatMasteryPercentage(mastery: number): number {
  return Math.round(mastery * 100);
}
