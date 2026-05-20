/**
 * Prompt Evaluator — 自动化评估 prompt 质量
 *
 * 基于预先定义的测试集（输入 + 期望输出特征）自动评估 prompt 效果。
 * 评估维度：
 *   1. 格式合规性：输出是否符合预期格式
 *   2. 结构完整性：关键结构元素是否存在
 *   3. 响应长度：是否在预期范围内
 *   4. 关键词覆盖：是否包含关键概念
 *
 * 使用方式：
 *   1. 为每个 prompt 定义测试用例
 *   2. 调用 evaluatePrompt() 传入 prompt 模板和测试用例
 *   3. 获取评估分数和改进建议
 */

import { fillTemplate } from "./promptRegistry";

// ============ 类型定义 ============

export interface TestCase {
  id: string;
  name: string;
  variables: Record<string, string | number | boolean>;
  expectedFormat?: "markdown" | "json" | "text";
  requiredSections?: string[]; // 必须包含的关键词/结构
  forbiddenPatterns?: string[]; // 禁止出现的模式（如"好的"、"没问题"）
  minLength?: number; // 期望的最小长度
  maxLength?: number; // 期望的最大长度
}

export interface EvaluationResult {
  testId: string;
  testName: string;
  passed: boolean;
  score: number; // 0-1
  checks: {
    checkName: string;
    passed: boolean;
    detail: string;
  }[];
  renderedPrompt: string; // 渲染后的 prompt 文本
}

export interface PromptEvaluation {
  promptId: string;
  promptVersion: string;
  timestamp: number;
  testResults: EvaluationResult[];
  averageScore: number;
  overallPassed: boolean;
  recommendations: string[];
}

// ============ 测试用例库 ============

export const defaultTestCases: Record<string, TestCase[]> = {
  system: [
    {
      id: "sys-001",
      name: "系统 prompt 应明确要求 Markdown 输出",
      variables: {},
      expectedFormat: "markdown",
      requiredSections: ["#", "##", "Markdown", "节点"],
      forbiddenPatterns: ["好的", "没问题", "代码块"],
      minLength: 100,
    },
  ],
  refine: [
    {
      id: "ref-001",
      name: "细化 prompt 应正确渲染模板变量",
      variables: {
        target: "梯度下降",
        context: "深度学习 > 优化算法",
        limitInstruction: "请生成 3-5 个子节点",
      },
      expectedFormat: "markdown",
      requiredSections: ["梯度下降", "深度学习 > 优化算法", "Markdown"],
      forbiddenPatterns: ["{{target}}", "{{context}}"],
      minLength: 50,
    },
    {
      id: "ref-002",
      name: "细化 prompt 应拒绝闲寒暄",
      variables: {
        target: "线性回归",
        context: "机器学习 > 监督学习",
        limitInstruction: "请生成 3-5 个子节点",
      },
      forbiddenPatterns: ["好的", "没问题", "当然"],
    },
  ],
  explain: [
    {
      id: "exp-001",
      name: "解释 prompt 应要求核心定义和重要性",
      variables: {
        target: "闭包",
        context: "JavaScript > 函数式编程",
      },
      requiredSections: ["核心定义", "重要"],
      forbiddenPatterns: ["{{target}}", "{{context}}", "好的", "没问题"],
      minLength: 50,
      maxLength: 600,
    },
  ],
  reorganize: [
    {
      id: "reorg-001",
      name: "重组 prompt 应要求消除重复",
      variables: {
        context: "CSS 布局",
        childrenMarkdown: "- Flexbox\n- Grid\n- 浮动",
      },
      requiredSections: ["重复", "Markdown"],
      forbiddenPatterns: ["{{childrenMarkdown}}"],
    },
  ],
  assessment: [
    {
      id: "assess-001",
      name: "考核 prompt 应要求 JSON 格式输出",
      variables: {
        context: "JavaScript Promise",
        scopeDescription: "异步编程",
        bloomLevel: "apply",
        questionCount: 5,
      },
      expectedFormat: "json",
      requiredSections: ["questions", "type", "difficulty", "correctAnswer"],
      forbiddenPatterns: ["{{questionCount}}"],
      minLength: 100,
    },
  ],
};

// ============ 评估逻辑 ============

/**
 * 检查格式合规性
 */
function checkFormat(text: string, format?: "markdown" | "json" | "text"): boolean {
  if (!format) return true;
  switch (format) {
    case "markdown":
      // 至少包含一个 Markdown 标题标记
      return /^#{1,6}\s/m.test(text);
    case "json":
      try {
        JSON.parse(text);
        return true;
      } catch {
        return /^\{[\s\S]*\}$/.test(text.trim());
      }
    case "text":
      return true; // text format is always valid
  }
}

/**
 * 检查必需结构是否包含
 */
function checkRequiredSections(
  text: string,
  sections: string[],
): { passed: boolean; missing: string[] } {
  const missing = sections.filter((s) => !text.includes(s));
  return {
    passed: missing.length === 0,
    missing,
  };
}

/**
 * 检查禁止模式
 */
function checkForbiddenPatterns(
  text: string,
  patterns: string[],
): { passed: boolean; found: string[] } {
  const found = patterns.filter((p) => text.includes(p));
  return {
    passed: found.length === 0,
    found,
  };
}

/**
 * 评估单个测试用例
 */
export function evaluateTestCase(template: string, testCase: TestCase): EvaluationResult {
  const rendered = fillTemplate(template, testCase.variables);
  const checks: EvaluationResult["checks"] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // 1. 格式检查
  if (testCase.expectedFormat) {
    totalChecks++;
    const formatOk = checkFormat(rendered, testCase.expectedFormat);
    if (formatOk) passedChecks++;
    checks.push({
      checkName: `格式合规 (${testCase.expectedFormat})`,
      passed: formatOk,
      detail: formatOk
        ? `输出符合 ${testCase.expectedFormat} 格式`
        : `期望 ${testCase.expectedFormat} 格式但未能检测到`,
    });
  }

  // 2. 必需结构检查
  if (testCase.requiredSections && testCase.requiredSections.length > 0) {
    totalChecks++;
    const { passed, missing } = checkRequiredSections(rendered, testCase.requiredSections);
    if (passed) passedChecks++;
    checks.push({
      checkName: "必需结构完整性",
      passed,
      detail: passed
        ? `包含所有必需结构 (${testCase.requiredSections.length}项)`
        : `缺失: ${missing.join(", ")}`,
    });
  }

  // 3. 禁止模式检查
  if (testCase.forbiddenPatterns && testCase.forbiddenPatterns.length > 0) {
    totalChecks++;
    const { passed, found } = checkForbiddenPatterns(rendered, testCase.forbiddenPatterns);
    if (passed) passedChecks++;
    checks.push({
      checkName: "禁止模式过滤",
      passed,
      detail: passed ? "无禁止模式" : `检测到禁止模式: ${found.join(", ")}`,
    });
  }

  // 4. 最小长度检查
  if (testCase.minLength !== undefined) {
    totalChecks++;
    const minOk = rendered.length >= testCase.minLength;
    if (minOk) passedChecks++;
    checks.push({
      checkName: `最小长度 (>=${testCase.minLength})`,
      passed: minOk,
      detail: `实际长度: ${rendered.length}${minOk ? "" : ` (不足 ${testCase.minLength})`}`,
    });
  }

  // 5. 最大长度检查
  if (testCase.maxLength !== undefined) {
    totalChecks++;
    const maxOk = rendered.length <= testCase.maxLength;
    if (maxOk) passedChecks++;
    checks.push({
      checkName: `最大长度 (<=${testCase.maxLength})`,
      passed: maxOk,
      detail: `实际长度: ${rendered.length}${maxOk ? "" : ` (超过 ${testCase.maxLength})`}`,
    });
  }

  const score = totalChecks > 0 ? passedChecks / totalChecks : 1;

  return {
    testId: testCase.id,
    testName: testCase.name,
    passed: score >= 0.8, // 80% 通过率视为通过
    score,
    checks,
    renderedPrompt: rendered,
  };
}

/**
 * 对某个 prompt 运行所有关联的测试用例
 */
export function evaluatePrompt(
  promptId: string,
  promptVersion: string,
  template: string,
  testCases: TestCase[],
): PromptEvaluation {
  const testResults = testCases.map((tc) => evaluateTestCase(template, tc));
  const averageScore = testResults.reduce((sum, r) => sum + r.score, 0) / testResults.length;
  const overallPassed = averageScore >= 0.8;
  const recommendations: string[] = [];

  // 生成改进建议
  const failedTests = testResults.filter((r) => !r.passed);
  if (failedTests.length > 0) {
    recommendations.push(`有 ${failedTests.length}/${testResults.length} 个测试未通过`);
    failedTests.forEach((ft) => {
      const failedChecks = ft.checks.filter((c) => !c.passed);
      failedChecks.forEach((fc) => {
        recommendations.push(`  - [${ft.testId}] ${fc.checkName}: ${fc.detail}`);
      });
    });
  }

  // 检查是否有未渲染的模板变量
  testResults.forEach((tr) => {
    const unrenderedVars = tr.renderedPrompt.match(/\{\{.*?\}\}/g);
    if (unrenderedVars && unrenderedVars.length > 0) {
      recommendations.push(`  - [${tr.testId}] 存在未渲染的模板变量: ${unrenderedVars.join(", ")}`);
    }
  });

  if (averageScore < 1) {
    recommendations.push(`综合评分 ${(averageScore * 100).toFixed(0)}%，建议优化后重新评估`);
  }

  return {
    promptId,
    promptVersion,
    timestamp: Date.now(),
    testResults,
    averageScore,
    overallPassed,
    recommendations,
  };
}

/**
 * 快速检查 — 验证模板变量是否完全渲染
 */
export function checkTemplateRendering(
  template: string,
  variables: Record<string, string | number | boolean>,
): {
  fullyRendered: boolean;
  unrendered: string[];
} {
  const rendered = fillTemplate(template, variables);
  const unrendered = Array.from(rendered.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]);
  return {
    fullyRendered: unrendered.length === 0,
    unrendered,
  };
}

export default evaluatePrompt;
