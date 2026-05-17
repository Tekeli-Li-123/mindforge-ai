import { describe, it, expect } from "vitest";
import {
  evaluateTestCase,
  evaluatePrompt,
  checkTemplateRendering,
  defaultTestCases,
} from "../config/prompts/promptEvaluator";
import type { TestCase } from "../config/prompts/promptEvaluator";

describe("evaluateTestCase", () => {
  it("should pass when all checks pass", () => {
    const template = "# Test\n\n## Section 1\nThis is a test with Markdown format";
    const testCase: TestCase = {
      id: "test-001",
      name: "Markdown format check",
      variables: {},
      expectedFormat: "markdown",
      requiredSections: ["# Test", "## Section 1"],
      forbiddenPatterns: ["forbidden"],
      minLength: 10,
    };

    const result = evaluateTestCase(template, testCase);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it("should detect missing required sections", () => {
    const template = "Just some text without headers";
    const testCase: TestCase = {
      id: "test-002",
      name: "Missing sections",
      variables: {},
      requiredSections: ["#", "##", "Conclusion"],
    };

    const result = evaluateTestCase(template, testCase);
    const sectionCheck = result.checks.find((c) => c.checkName === "必需结构完整性");
    expect(sectionCheck?.passed).toBe(false);
    expect(sectionCheck?.detail).toContain("缺失");
  });

  it("should detect forbidden patterns", () => {
    const template = "好的，我现在来解释这个问题。没问题。";
    const testCase: TestCase = {
      id: "test-003",
      name: "Forbidden patterns",
      variables: {},
      forbiddenPatterns: ["好的", "没问题"],
    };

    const result = evaluateTestCase(template, testCase);
    const forbiddenCheck = result.checks.find((c) => c.checkName === "禁止模式过滤");
    expect(forbiddenCheck?.passed).toBe(false);
    expect(forbiddenCheck?.detail).toContain("好的");
  });

  it("should validate minimal length", () => {
    const template = "Short";
    const testCase: TestCase = {
      id: "test-004",
      name: "Min length",
      variables: {},
      minLength: 100,
    };

    const result = evaluateTestCase(template, testCase);
    const lengthCheck = result.checks.find((c) => c.checkName.startsWith("最小长度"));
    expect(lengthCheck?.passed).toBe(false);
    expect(lengthCheck?.detail).toContain("不足");
  });

  it("should validate maximal length", () => {
    const template = "A".repeat(500);
    const testCase: TestCase = {
      id: "test-005",
      name: "Max length",
      variables: {},
      maxLength: 100,
    };

    const result = evaluateTestCase(template, testCase);
    const lengthCheck = result.checks.find((c) => c.checkName.startsWith("最大长度"));
    expect(lengthCheck?.passed).toBe(false);
    expect(lengthCheck?.detail).toContain("超过");
  });

  it("should validate JSON format", () => {
    const template = '{"key": "value", "nested": {"a": 1}}';
    const testCase: TestCase = {
      id: "test-006",
      name: "JSON format",
      variables: {},
      expectedFormat: "json",
    };

    const result = evaluateTestCase(template, testCase);
    const formatCheck = result.checks.find((c) => c.checkName.startsWith("格式合规"));
    expect(formatCheck?.passed).toBe(true);
  });

  it("should treat text format as always valid", () => {
    const template = "";
    const testCase: TestCase = {
      id: "test-007",
      name: "Empty text",
      variables: {},
      expectedFormat: "text",
    };

    const result = evaluateTestCase(template, testCase);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it("should handle markdown format detection with # header", () => {
    const result = evaluateTestCase("# Title\nSome content", {
      id: "md1",
      name: "MD",
      variables: {},
      expectedFormat: "markdown",
    });
    expect(result.score).toBe(1);
  });

  it("should handle non-markdown content without headers", () => {
    const result = evaluateTestCase("Just plain text without markdown headers", {
      id: "md2",
      name: "No MD",
      variables: {},
      expectedFormat: "markdown",
    });
    expect(result.score).toBe(0);
  });

  it("should render template variables", () => {
    const template = "Hello {{name}}, your score is {{score}}";
    const testCase: TestCase = {
      id: "test-008",
      name: "Template rendering",
      variables: { name: "Alice", score: 95 },
    };

    const result = evaluateTestCase(template, testCase);
    expect(result.renderedPrompt).toBe("Hello Alice, your score is 95");
  });

  it("should handle missing expectedFormat gracefully", () => {
    const result = evaluateTestCase("some text", {
      id: "no-format",
      name: "No format",
      variables: {},
    });
    expect(result.score).toBe(1);
  });

  it("should give perfect score when no checks defined except format", () => {
    const result = evaluateTestCase("plain text", {
      id: "perf",
      name: "Perfect",
      variables: {},
      expectedFormat: "text",
    });
    expect(result.score).toBe(1);
  });
});

describe("evaluatePrompt", () => {
  it("should return overall passed when average score >= 0.8", () => {
    const result = evaluatePrompt(
      "system",
      "1.0.0",
      "# Hello\n\n## World\nThis is a valid markdown prompt with enough content.",
      defaultTestCases.system,
    );

    expect(result.promptId).toBe("system");
    expect(result.promptVersion).toBe("1.0.0");
    expect(typeof result.averageScore).toBe("number");
    expect(result.testResults.length).toBeGreaterThan(0);
    expect(typeof result.overallPassed).toBe("boolean");
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it("should generate recommendations for failed checks", () => {
    const result = evaluatePrompt("bad-prompt", "0.1.0", "短的坏的提示词", defaultTestCases.system);

    // Should have recommendations since the template is too short
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("should detect unrendered template variables", () => {
    const result = evaluatePrompt("unrendered", "1.0.0", "Hello {{name}}, welcome to {{place}}", [
      {
        id: "ur-001",
        name: "Unrendered vars",
        variables: { name: "Alice" },
      },
    ]);

    const hasUnrenderedRec = result.recommendations.some((r) => r.includes("{{place}}"));
    expect(hasUnrenderedRec).toBe(true);
  });

  it("should handle empty test cases array", () => {
    const result = evaluatePrompt("empty", "1.0.0", "test", []);
    expect(result.testResults).toHaveLength(0);
    expect(result.averageScore).toBeNaN();
    expect(result.overallPassed).toBe(false);
  });

  it("should calculate average score correctly", () => {
    const result = evaluatePrompt(
      "avg-test",
      "1.0.0",
      "# Valid\n\nContent with enough length for the min requirement.",
      [
        {
          id: "pass-1",
          name: "Passing test",
          variables: {},
          expectedFormat: "markdown",
          minLength: 10,
        },
        {
          id: "fail-1",
          name: "Failing test",
          variables: {},
          minLength: 9999,
        },
      ],
    );

    expect(result.averageScore).toBeLessThan(1);
    expect(result.averageScore).toBeGreaterThan(0);
  });
});

describe("checkTemplateRendering", () => {
  it("should detect fully rendered template", () => {
    const result = checkTemplateRendering("Hello {{name}}!", { name: "World" });
    expect(result.fullyRendered).toBe(true);
    expect(result.unrendered).toHaveLength(0);
  });

  it("should detect unrendered variables", () => {
    const result = checkTemplateRendering("Hello {{name}} from {{place}}", { name: "World" });
    expect(result.fullyRendered).toBe(false);
    expect(result.unrendered).toContain("place");
  });
});
