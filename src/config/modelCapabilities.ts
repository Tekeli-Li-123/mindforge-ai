// ==========================================
// MindForge AI — 模型能力规则引擎
// 根据模型名 + Provider 自动推断 API 参数能力
// ==========================================

import type { AIProvider } from "../stores/settingsStore";

/** 模型能力描述 */
export interface ModelCapabilities {
  /** 是否为推理/思维链模型 */
  isReasoning: boolean;
  /** 是否支持 temperature 参数 */
  supportsTemperature: boolean;
  /** 是否支持标准 system role（false 则需用替代 role） */
  supportsSystemRole: boolean;
  /** 推理强度控制方式：none=无控制, effort=reasoning_effort/effort, budget=budget_tokens */
  reasoningControl: "none" | "effort" | "budget";
  /** 响应中思维过程的字段名（如 DeepSeek 的 reasoning_content） */
  responseReasoningField?: string;
  /** system role 的替代名称（如 OpenAI 推理模型用 developer） */
  systemRoleAlternative?: string;
  /** 是否使用原生 Anthropic Messages API（而非 OpenAI 兼容格式） */
  useNativeAnthropicAPI?: boolean;
}

/** 默认能力（普通非推理模型） */
const DEFAULT_CAPABILITIES: ModelCapabilities = {
  isReasoning: false,
  supportsTemperature: true,
  supportsSystemRole: true,
  reasoningControl: "none",
};

/**
 * 模式匹配规则表
 * 按优先级从高到低排列，第一个匹配的生效
 * 扩展新模型只需追加规则，零侵入性
 */
const MODEL_RULES: Array<{
  match: (model: string, provider: string) => boolean;
  capabilities: Partial<ModelCapabilities>;
  label: string; // 用于 UI 展示的匹配描述
}> = [
  // ═══════════════ OpenAI 推理模型 ═══════════════
  {
    label: "OpenAI o 系列推理模型",
    match: (m, p) => p === "openai" && /^(o1|o3|o4)/i.test(m),
    capabilities: {
      isReasoning: true,
      supportsTemperature: false,
      supportsSystemRole: false,
      reasoningControl: "effort",
      systemRoleAlternative: "developer",
    },
  },
  {
    label: "OpenAI GPT-5 Thinking 系列",
    match: (m, p) => p === "openai" && /gpt\.5.*think/i.test(m),
    capabilities: {
      isReasoning: true,
      supportsTemperature: false,
      supportsSystemRole: false,
      reasoningControl: "effort",
      systemRoleAlternative: "developer",
    },
  },

  // ═══════════════ Anthropic Claude ═══════════════
  {
    label: "Claude 3.7 (Extended Thinking)",
    match: (m, p) => p === "anthropic" && /claude.*3\.7/i.test(m),
    capabilities: {
      isReasoning: true,
      supportsTemperature: true,
      supportsSystemRole: true,
      reasoningControl: "budget",
      useNativeAnthropicAPI: true,
    },
  },
  {
    label: "Claude 4.x+ (Adaptive Thinking)",
    match: (m, p) => p === "anthropic" && /claude.*(4\.[5-9]|4\.\d{2,}|(?<!\d\.)[5-9]\.)/i.test(m),
    capabilities: {
      isReasoning: true,
      supportsTemperature: true,
      supportsSystemRole: true,
      reasoningControl: "effort",
      useNativeAnthropicAPI: true,
    },
  },
  {
    label: "Claude (标准)",
    match: (_m, p) => p === "anthropic",
    capabilities: {
      isReasoning: false,
      supportsTemperature: true,
      supportsSystemRole: true,
      reasoningControl: "none",
      useNativeAnthropicAPI: true,
    },
  },

  // ═══════════════ DeepSeek ═══════════════
  {
    label: "DeepSeek V4 Pro (思考模式)",
    match: (m, p) => p === "deepseek" && /v4\.pro|v4pro/i.test(m),
    capabilities: {
      isReasoning: true,
      supportsTemperature: false,
      supportsSystemRole: true,
      reasoningControl: "effort",
      responseReasoningField: "reasoning_content",
    },
  },
  {
    label: "DeepSeek Reasoner (Legacy)",
    match: (m, p) => p === "deepseek" && /reasoner|r1/i.test(m),
    capabilities: {
      isReasoning: true,
      supportsTemperature: false,
      supportsSystemRole: true,
      reasoningControl: "effort",
      responseReasoningField: "reasoning_content",
    },
  },
  {
    label: "DeepSeek V4 Flash / Chat (标准)",
    match: (_m, p) => p === "deepseek",
    capabilities: {
      isReasoning: false,
      supportsTemperature: true,
      supportsSystemRole: true,
      reasoningControl: "none",
    },
  },
];

/**
 * 根据模型名和 Provider 自动推断模型能力
 * @returns 匹配到的能力描述，未匹配则返回默认能力
 */
export function detectModelCapabilities(
  model: string,
  provider: AIProvider | string,
): ModelCapabilities {
  const m = model.toLowerCase().trim();
  const p = provider.toLowerCase().trim();
  // Normalize hyphens to dots for version matching (e.g. "claude-sonnet-4-5" → "claude.sonnet.4.5")
  const normalized = m.replace(/-/g, ".");

  for (const rule of MODEL_RULES) {
    if (rule.match(normalized, p)) {
      return { ...DEFAULT_CAPABILITIES, ...rule.capabilities };
    }
  }

  return { ...DEFAULT_CAPABILITIES };
}

/**
 * 获取匹配的规则标签（用于 Settings UI 展示）
 * @returns 匹配规则的描述文本，未匹配则返回 null
 */
export function getMatchedRuleLabel(model: string, provider: AIProvider | string): string | null {
  const m = model.toLowerCase().trim();
  const p = provider.toLowerCase().trim();
  const normalized = m.replace(/-/g, ".");

  for (const rule of MODEL_RULES) {
    if (rule.match(normalized, p)) {
      return rule.label;
    }
  }

  return null;
}
