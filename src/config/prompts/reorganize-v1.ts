/**
 * Reorganize Prompt v1 — 子节点逻辑重组
 *
 * 版本: 1.0.0
 * 创建: 2026-05
 * 适用模型: 通用
 *
 * 设计原则:
 *   1. 输入一堆杂乱子节点，输出按逻辑归类的层级树
 *   2. 2-3 个归类维度，消除重复项
 *   3. 纯 Markdown 列表输出，不包含顶层根节点名
 */

export const PROMPT_ID = "reorganize-v1";
export const PROMPT_VERSION = "1.0.0";

export const REORGANIZE_PROMPT_V1 = `请审视以下属于 "{{context}}" 父级概念下的一堆杂乱子节点。

我需要你帮我找出内部的逻辑规律，重新梳理出清晰的层级树（不超过 2-3 个归类维度），消除重复项。

极其重要：请直接给回按照逻辑归类的纯 Markdown 列表，要求最顶层必须是这些重新归类后的类别（不要再带上原来的顶层根节点名）。绝对不要包含解释文字和寒暄，不要用代码块包裹。

原有的这些叶子节点内容：

{{childrenMarkdown}}`;

/** 模板变量说明 */
export const REORGANIZE_TEMPLATE_VARS = {
  context: "待重组的父级概念路径",
  childrenMarkdown: "杂乱子节点的 Markdown 列表",
};

export const reorganizePromptV1Meta = {
  id: PROMPT_ID,
  version: PROMPT_VERSION,
  description: "子节点逻辑重组 / 归类去重",
  author: "MindForge AI Team",
  compatibleModels: ["openai", "anthropic", "deepseek", "local"] as string[],
  tags: ["reorganize", "mindmap", "cleanup"] as string[],
};

export default REORGANIZE_PROMPT_V1;
