/**
 * Refine Prompt v1 — 节点细化发散
 *
 * 版本: 1.0.0
 * 创建: 2026-05
 * 适用模型: 通用
 *
 * 设计原则:
 *   1. 根据已有上下文路径，精准发散子节点
 *   2. 支持节点数量约束 (limitInstruction)
 *   3. 纯 Markdown 列表输出，无附加文字
 */

export const PROMPT_ID = "refine-v1";
export const PROMPT_VERSION = "1.0.0";

export const REFINE_PROMPT_V1 = `请围绕知识点 "{{target}}" 帮我细化和发散出具体的子节点。这个知识点所在的完整上下文路径是: {{context}}。

要求：
1. 只返回 "{{target}}" 的直接子节点及后续层级，以 Markdown 提供。
2. {{limitInstruction}}
3. 不要包含原节点本身作为统一根节点，如果有单个总览节点可以直接去掉。
4. 极其重要：只返回 Markdown 列表，不要带任何寒暄、不要带代码块包裹标记、不要进行除了节点文本外的任何解释。`;

/** 模板变量说明 */
export const REFINE_TEMPLATE_VARS = {
  target: "待细化的知识点名称",
  context: "知识点在导图中的完整路径（面包屑）",
  limitInstruction: '节点数量约束文本（如"请生成 3-5 个子节点"）',
};

export const refinePromptV1Meta = {
  id: PROMPT_ID,
  version: PROMPT_VERSION,
  description: "节点细化发散 / 子节点生成",
  author: "MindForge AI Team",
  compatibleModels: ["openai", "anthropic", "deepseek", "local"] as string[],
  tags: ["refine", "mindmap", "expansion"] as string[],
};

export default REFINE_PROMPT_V1;
