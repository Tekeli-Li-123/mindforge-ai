/**
 * Prompt Registry — 版本注册 + 回退机制
 *
 * 核心职责:
 *   1. 注册所有版本化 prompt（带元数据）
 *   2. 提供按 ID 获取最新版本的能力
 *   3. 当指定版本不可用时自动回退
 *   4. 模板变量填充（安全的 Mustache 风格替换）
 *   5. 模型兼容性匹配
 */

import SYSTEM_PROMPT_V1, { systemPromptV1Meta } from "./system-v1";
import REFINE_PROMPT_V1, { refinePromptV1Meta } from "./refine-v1";
import EXPLAIN_PROMPT_V1, { explainPromptV1Meta } from "./explain-v1";
import REORGANIZE_PROMPT_V1, { reorganizePromptV1Meta } from "./reorganize-v1";
import ASSESSMENT_PROMPT_V1, { assessmentPromptV1Meta } from "./assessment-v1";
import {
  TEMPLATE as ASSESSMENT_EVALUATE_TEMPLATE,
  META as assessmentEvaluateMeta,
} from "./assessment-evaluate-v1";
import { getTopKExamples, formatExamplesAsContext } from "./fewShotExamples";

// ============ 类型定义 ============

export interface PromptMeta {
  id: string;
  version: string;
  description: string;
  author: string;
  compatibleModels: string[];
  tags: string[];
}

export interface PromptEntry {
  template: string;
  meta: PromptMeta;
}

// 实际支持所有 string，定义别名方便 TS 提示
type CategoryId = string;

// ============ 注册表 ============

/** 内部注册表：category -> (version -> PromptEntry) */
const registry: Record<string, Map<string, PromptEntry>> = {};

/** 别名映射：短名称 -> 精确的 category@version */
const aliases: Record<string, { category: string; version: string }> = {};

/** 默认版本映射 */
const defaultVersions: Record<string, string> = {};

// ============ 注册 API ============

/**
 * 注册一个 prompt 到注册表
 */
export function registerPrompt(
  category: CategoryId,
  version: string,
  template: string,
  meta: PromptMeta,
): void {
  if (!registry[category]) {
    registry[category] = new Map();
  }
  registry[category].set(version, { template, meta });

  // 如果没有设置默认版本，自动设为第一个注册的版本
  if (!defaultVersions[category]) {
    defaultVersions[category] = version;
  }
}

/**
 * 注册带版本号的别名（例如 "system" -> "system@1.0.0"）
 */
export function registerAlias(alias: string, category: CategoryId, version: string): void {
  aliases[alias] = { category, version };
}

// ============ 查询 API ============

export interface PromptResult {
  template: string;
  meta: PromptMeta;
  resolvedCategory: string;
  resolvedVersion: string;
  fallbackChain: string[]; // 回退链，记录最终使用了哪个版本
}

/**
 * 获取 prompt，支持版本回退
 * @param category 类别
 * @param preferredVersion 首选版本（可选）
 * @returns PromptResult 或 null（如果完全不可用）
 */
export function getPrompt(category: CategoryId, preferredVersion?: string): PromptResult | null {
  const catRegistry = registry[category];
  if (!catRegistry || catRegistry.size === 0) return null;

  const fallbackChain: string[] = [];

  // 1. 尝试首选版本
  if (preferredVersion && catRegistry.has(preferredVersion)) {
    const entry = catRegistry.get(preferredVersion)!;
    fallbackChain.push(`${category}@${preferredVersion}`);
    return {
      template: entry.template,
      meta: entry.meta,
      resolvedCategory: category,
      resolvedVersion: preferredVersion,
      fallbackChain,
    };
  }

  // 2. 尝试默认版本
  const defaultVer = defaultVersions[category];
  if (defaultVer && catRegistry.has(defaultVer)) {
    const entry = catRegistry.get(defaultVer)!;
    fallbackChain.push(`${category}@${defaultVer} (default)`);
    return {
      template: entry.template,
      meta: entry.meta,
      resolvedCategory: category,
      resolvedVersion: defaultVer,
      fallbackChain,
    };
  }

  // 3. 回退到最新注册的版本
  const versions = Array.from(catRegistry.keys());
  const latestVersion = versions[versions.length - 1];
  if (latestVersion) {
    const entry = catRegistry.get(latestVersion)!;
    fallbackChain.push(`${category}@${latestVersion} (latest fallback)`);
    return {
      template: entry.template,
      meta: entry.meta,
      resolvedCategory: category,
      resolvedVersion: latestVersion,
      fallbackChain,
    };
  }

  return null;
}

/**
 * 按别名获取 prompt
 */
export function getPromptByAlias(alias: string): PromptResult | null {
  const mapping = aliases[alias];
  if (!mapping) return null;
  return getPrompt(mapping.category as CategoryId, mapping.version);
}

// ============ 模板填充 API ============

/**
 * 安全的模板变量填充
 * 替换 {{variableName}} 为对应的值
 * 对缺失变量保留原样（不报错）
 */
export function fillTemplate(
  template: string,
  variables: Record<string, string | number | boolean>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), String(value));
  }
  return result;
}

/**
 * 一键获取并填充 prompt
 */
export function getFilledPrompt(
  category: CategoryId,
  variables: Record<string, string | number | boolean>,
  options?: {
    preferredVersion?: string;
    includeFewShot?: boolean;
    fewShotCount?: number;
  },
): { text: string; meta: PromptMeta; fallbackChain: string[] } | null {
  const result = getPrompt(category, options?.preferredVersion);
  if (!result) return null;

  let text = fillTemplate(result.template, variables);

  // 可选：在 prompt 末尾附加 few-shot 示例
  if (options?.includeFewShot) {
    const examples = getTopKExamples(category, options?.fewShotCount ?? 1);
    if (examples.length > 0) {
      text += "\n\n参考示例：\n" + formatExamplesAsContext(examples);
    }
  }

  return {
    text,
    meta: result.meta,
    fallbackChain: result.fallbackChain,
  };
}

/**
 * 检查某个类别是否有特定版本
 */
export function hasVersion(category: CategoryId, version: string): boolean {
  return registry[category]?.has(version) ?? false;
}

/**
 * 列出某个类别的所有可用版本
 */
export function listVersions(category: CategoryId): { version: string; meta: PromptMeta }[] {
  const catRegistry = registry[category];
  if (!catRegistry) return [];
  return Array.from(catRegistry.entries()).map(([version, entry]) => ({
    version,
    meta: entry.meta,
  }));
}

/**
 * 获取所有已注册的类别
 */
export function getRegisteredCategories(): string[] {
  return Object.keys(registry);
}

// ============ 初始化注册 ============

// --- system ---
registerPrompt("system", "1.0.0", SYSTEM_PROMPT_V1, systemPromptV1Meta);
registerAlias("system", "system", "1.0.0");

// --- refine ---
registerPrompt("refine", "1.0.0", REFINE_PROMPT_V1, refinePromptV1Meta);
registerAlias("refine", "refine", "1.0.0");

// --- explain ---
registerPrompt("explain", "1.0.0", EXPLAIN_PROMPT_V1, explainPromptV1Meta);
registerAlias("explain", "explain", "1.0.0");

// --- reorganize ---
registerPrompt("reorganize", "1.0.0", REORGANIZE_PROMPT_V1, reorganizePromptV1Meta);
registerAlias("reorganize", "reorganize", "1.0.0");

// --- assessment (出题) ---
registerPrompt("assessment", "1.0.0", ASSESSMENT_PROMPT_V1, assessmentPromptV1Meta);
registerAlias("assessment", "assessment", "1.0.0");

// --- assessment-evaluate (独立评估，与出题分离) ---
registerPrompt(
  "assessment-evaluate",
  "1.0.0",
  ASSESSMENT_EVALUATE_TEMPLATE,
  assessmentEvaluateMeta,
);
registerAlias("assessment-evaluate", "assessment-evaluate", "1.0.0");

export default registry;
