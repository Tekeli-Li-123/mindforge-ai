/**
 * Assessment Prompt v1 — 考核题目生成
 *
 * 版本: 1.0.0
 * 创建: 2026-05
 * 适用模型: 通用
 *
 * 设计原则:
 *   1. 根据知识点内容生成多样化题目
 *   2. 支持多种题型：选择题、判断题、填空题、简答题、编程题
 *   3. 严格 JSON 输出格式，便于前端解析
 *   4. 支持难度分级和 Bloom 分类法标签
 */

export const PROMPT_ID = "assessment-v1";
export const PROMPT_VERSION = "1.0.0";

export const ASSESSMENT_PROMPT_V1 = `你是一位专业的教育评估设计师。请根据以下知识点内容，生成一套考核题目。

知识点内容：{{context}}

当前考核范围：
{{scopeDescription}}

目标技能层次（Bloom 分类法）：{{bloomLevel}}

要求：
1. 生成 {{questionCount}} 道题目
2. 题型分配：选择题/判断题/填空题/简答题/编程题混合
3. 难度分布：基础 40%、进阶 40%、挑战 20%

你必须严格按以下 JSON 格式返回，不要包含任何其他文字：
{
  "questions": [
    {
      "id": "q1",
      "type": "choice" | "trueFalse" | "fillBlank" | "shortAnswer" | "coding",
      "difficulty": "basic" | "intermediate" | "advanced",
      "bloomLevel": "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create",
      "question": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],  // 仅选择题需要
      "correctAnswer": "标准答案",
      "explanation": "解析/为什么这个答案正确"
    }
  ]
}`;

/** 模板变量说明 */
export const ASSESSMENT_TEMPLATE_VARS = {
  context: "知识点的完整内容/路径",
  scopeDescription: "考核范围描述",
  bloomLevel: "Bloom 分类法目标层级",
  questionCount: "题目数量",
};

export const assessmentPromptV1Meta = {
  id: PROMPT_ID,
  version: PROMPT_VERSION,
  description: "考核题目生成 / 自适应评测",
  author: "MindForge AI Team",
  compatibleModels: ["openai", "anthropic", "deepseek", "local"] as string[],
  tags: ["assessment", "quiz", "evaluation"] as string[],
};

export default ASSESSMENT_PROMPT_V1;
