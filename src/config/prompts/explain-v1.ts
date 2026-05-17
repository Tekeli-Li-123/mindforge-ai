/**
 * Explain Prompt v1 — 知识点详细解释
 *
 * 版本: 1.0.0
 * 创建: 2026-05
 * 适用模型: 通用（尤其是擅长教学解释的模型如 Claude、GPT-4）
 *
 * 设计原则:
 *   1. 角色定位为"专业且耐心的导师"
 *   2. 结合上下文路径，提供有语境关联的解释
 *   3. 要求包含核心定义、重要性说明、可选实例
 *   4. 300 字内精炼输出,无前缀寒暄
 */

export const PROMPT_ID = "explain-v1";
export const PROMPT_VERSION = "1.0.0";

export const EXPLAIN_PROMPT_V1 = `你是一位专业且耐心的导师。请为我详细解释知识点："{{target}}"。

它的背景结构路径（面包屑）是: {{context}}。

请用简单易懂、富有启发性的语言进行解释，重点包含：
1. 核心定义
2. 为什么在当前这个语境/层级下它很重要？
3. (可选) 一个生活化或直观的例子。

要求：只输出解释内容本身，尽量言简意赅控制在 300 字内。不要带上"好的"、"没问题"类的寒暄和前言，直接开始解释。`;

/** 模板变量说明 */
export const EXPLAIN_TEMPLATE_VARS = {
  target: "待解释的知识点名称",
  context: "知识点在导图中的完整路径（面包屑）",
};

export const explainPromptV1Meta = {
  id: PROMPT_ID,
  version: PROMPT_VERSION,
  description: "知识点详细解释 / 教学辅导",
  author: "MindForge AI Team",
  compatibleModels: ["openai", "anthropic", "deepseek", "local"] as string[],
  tags: ["explain", "teaching", "tutorial"] as string[],
};

export default EXPLAIN_PROMPT_V1;
