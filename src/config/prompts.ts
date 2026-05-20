/**
 * @file Legado — 统一 Prompt 导出入口
 *
 * 本文件保持向后兼容，从新的版本化 prompt 目录重新导出。
 * 新代码应直接使用 promptRegistry 的 getFilledPrompt 或 getPrompt。
 *
 * @see ./prompts/README.md
 * @see ./prompts/promptRegistry.ts
 */

import { getFilledPrompt, getPrompt } from "./prompts/promptRegistry";

/**
 * 从 registry 获取最新版本的 system prompt
 */
export const DEFAULT_SYSTEM_PROMPT = (() => {
  const result = getPrompt("system");
  return result?.template ?? "";
})();

/**
 * 从 registry 获取最新版本的 refine prompt
 */
export const DEFAULT_REFINE_PROMPT = (() => {
  const result = getPrompt("refine");
  return result?.template ?? "";
})();

/**
 * 从 registry 获取最新版本的 explain prompt
 */
export const DEFAULT_EXPLAIN_PROMPT = (() => {
  const result = getPrompt("explain");
  return result?.template ?? "";
})();

/**
 * 从 registry 获取最新版本的 reorganize prompt
 */
export const DEFAULT_REORGANIZE_PROMPT = (() => {
  const result = getPrompt("reorganize");
  return result?.template ?? "";
})();

/**
 * 从 registry 获取最新版本的 assessment prompt
 */
export const DEFAULT_ASSESSMENT_PROMPT = (() => {
  const result = getPrompt("assessment");
  return result?.template ?? "";
})();

// ============ 便捷填充函数（向后兼容） ============

/**
 * 填充 system prompt（向后兼容）
 * @deprecated 请直接使用 getFilledPrompt('system', variables)
 */
export function fillSystemPrompt(topic: string, title?: string, description?: string): string {
  return (
    getFilledPrompt("system", {
      topic: topic || "",
      title: title || "",
      description: description || "",
    })?.text ?? DEFAULT_SYSTEM_PROMPT
  );
}

/**
 * 填充 refine prompt（向后兼容）
 * @deprecated 请直接使用 getFilledPrompt('refine', variables)
 */
export function fillRefinePrompt(
  target: string,
  context: string,
  limitInstruction?: string,
): string {
  return (
    getFilledPrompt(
      "refine",
      {
        target,
        context,
        limitInstruction: limitInstruction || "请生成 3-5 个子节点",
      },
      { includeFewShot: true, fewShotCount: 1 },
    )?.text ?? ""
  );
}

/**
 * 填充 explain prompt（向后兼容）
 * @deprecated 请直接使用 getFilledPrompt('explain', variables)
 */
export function fillExplainPrompt(target: string, context: string): string {
  return (
    getFilledPrompt(
      "explain",
      {
        target,
        context,
      },
      { includeFewShot: true, fewShotCount: 1 },
    )?.text ?? ""
  );
}

/**
 * 填充 reorganize prompt（向后兼容）
 * @deprecated 请直接使用 getFilledPrompt('reorganize', variables)
 */
export function fillReorganizePrompt(context: string, childrenMarkdown: string): string {
  return (
    getFilledPrompt(
      "reorganize",
      {
        context,
        childrenMarkdown,
      },
      { includeFewShot: true, fewShotCount: 1 },
    )?.text ?? ""
  );
}

// ============ 重新导出 Registry 中所有公开 API ============

export {
  getPrompt,
  getPromptByAlias,
  getFilledPrompt,
  fillTemplate,
  hasVersion,
  listVersions,
  getRegisteredCategories,
  registerPrompt,
  registerAlias,
} from "./prompts/promptRegistry";

export type { PromptMeta, PromptEntry, PromptResult } from "./prompts/promptRegistry";

// ============ 重新导出 Evaluator API ============

export {
  evaluateTestCase,
  evaluatePrompt,
  checkTemplateRendering,
} from "./prompts/promptEvaluator";

export type { TestCase, EvaluationResult, PromptEvaluation } from "./prompts/promptEvaluator";

// ============ 重新导出 Few-shot API ============

export {
  getExamplesByCategory,
  getExamplesByTag,
  getTopKExamples,
  formatExamplesAsContext,
} from "./prompts/fewShotExamples";

export type { FewShotExample } from "./prompts/fewShotExamples";
