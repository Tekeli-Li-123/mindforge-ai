import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssessmentService } from "../services/assessmentService";
import type { MindMapNode } from "../types";

// Mock fetchFromAI
vi.mock("../services/aiService", () => ({
  fetchFromAI: vi.fn(),
}));

import { fetchFromAI } from "../services/aiService";

const mockNode: MindMapNode = {
  id: "node-closure",
  content: "闭包 (Closure)",
  depth: 0,
  mastery: 0.5,
  expanded: false,
  children: [],
  explanation: "函数与其词法环境的引用组合",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AssessmentService", () => {
  describe("generateAssessmentBatch", () => {
    it("should generate a batch of quiz questions", async () => {
      const aiResponse = JSON.stringify({
        questions: [
          {
            type: "choice",
            question: "什么是闭包？",
            options: ["A选项", "B选项", "C选项", "D选项"],
            correctAnswer: "A选项",
            explanation: "闭包是函数与词法环境的组合",
            difficulty: "easy",
          },
          {
            type: "openEnded",
            question: "请解释闭包的工作原理",
            referenceAnswer: "闭包捕捉外部函数的变量环境……",
            explanation: "考察对闭包本质的理解",
            difficulty: "medium",
          },
        ],
      });
      vi.mocked(fetchFromAI).mockResolvedValue(aiResponse);

      const result = await AssessmentService.generateAssessmentBatch(
        mockNode,
        "JavaScript > 闭包",
        "medium",
        2,
        ["choice", "openEnded"],
      );

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("choice");
      expect(result[0].question).toBe("什么是闭包？");
      expect(result[0].relatedNodeId).toBe("node-closure");
      expect(result[1].type).toBe("openEnded");
      expect(result[1].referenceAnswer).toBe("闭包捕捉外部函数的变量环境……");
    });

    it("should handle single-object response (not questions array)", async () => {
      const singleObj = {
        questions: [
          {
            type: "trueFalse",
            question: "闭包会导致内存泄漏吗？",
            correctAnswer: "正确",
            explanation: "如果不当使用……",
            difficulty: "hard",
          },
        ],
      };
      vi.mocked(fetchFromAI).mockResolvedValue(JSON.stringify(singleObj));

      const result = await AssessmentService.generateAssessmentBatch(
        mockNode,
        "JavaScript",
        "hard",
        1,
        ["trueFalse"],
      );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("trueFalse");
    });

    it("should strip markdown code fences from AI response", async () => {
      const aiResponse =
        '```json\n{"questions":[{"type":"openEnded","question":"Q?","referenceAnswer":"A","explanation":"E","difficulty":"easy"}]}\n```';
      vi.mocked(fetchFromAI).mockResolvedValue(aiResponse);

      const result = await AssessmentService.generateAssessmentBatch(mockNode, "path", "easy", 1, [
        "openEnded",
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].question).toBe("Q?");
    });

    it("should assign unique IDs to each question", async () => {
      const aiResponse = JSON.stringify({
        questions: [
          { type: "openEnded", question: "Q1", referenceAnswer: "A1", explanation: "E1" },
          { type: "openEnded", question: "Q2", referenceAnswer: "A2", explanation: "E2" },
        ],
      });
      vi.mocked(fetchFromAI).mockResolvedValue(aiResponse);

      const result = await AssessmentService.generateAssessmentBatch(mockNode, "path", "easy", 2, [
        "openEnded",
      ]);

      expect(result[0].id).toBeTruthy();
      expect(result[1].id).toBeTruthy();
      expect(result[0].id).not.toBe(result[1].id);
    });

    it("should throw on invalid JSON from AI", async () => {
      vi.mocked(fetchFromAI).mockResolvedValue("not valid json at all");

      await expect(
        AssessmentService.generateAssessmentBatch(mockNode, "path", "easy", 1, ["openEnded"]),
      ).rejects.toThrow("AI 生成题目失败");
    });
  });

  describe("regenerateQuestion", () => {
    it("should generate an alternative question", async () => {
      vi.mocked(fetchFromAI).mockResolvedValue(
        JSON.stringify({
          questions: [
            {
              type: "choice",
              question: "新题目?",
              options: ["A", "B", "C", "D"],
              correctAnswer: "A",
              explanation: "E",
              difficulty: "medium",
            },
          ],
        }),
      );

      const result = await AssessmentService.regenerateQuestion(
        mockNode,
        "path",
        "旧题目内容",
        "medium",
        ["choice"],
      );

      expect(result.question).toBe("新题目?");
      expect(fetchFromAI).toHaveBeenCalledTimes(1);
    });
  });

  describe("extractEvidence", () => {
    it("should parse LLM evidence correctly", async () => {
      const aiResponse = JSON.stringify({
        recall: 0.8,
        comprehension: 0.6,
        application: 0.4,
        analysis: 0.7,
        feedback: "表现不错，可以加强应用练习。",
        errorType: "conceptual",
        suggestion: "多做一些实践题。",
      });
      vi.mocked(fetchFromAI).mockResolvedValue(aiResponse);

      const result = await AssessmentService.extractEvidence(
        "闭包",
        "定义",
        "什么是闭包？",
        "标准答案",
        "用户的回答",
      );

      expect(result.recall).toBe(0.8);
      expect(result.comprehension).toBe(0.6);
      expect(result.errorType).toBe("conceptual");
      expect(result.feedback).toBe("表现不错，可以加强应用练习。");
    });

    it("should clamp scores to [0, 1]", async () => {
      const aiResponse = JSON.stringify({
        recall: 1.5,
        comprehension: -0.5,
        application: 0.5,
        analysis: 0.8,
        feedback: "ok",
        errorType: "none",
        suggestion: "继续努力",
      });
      vi.mocked(fetchFromAI).mockResolvedValue(aiResponse);

      const result = await AssessmentService.extractEvidence("闭包", "定义", "Q", "A", "用户回答");

      expect(result.recall).toBe(1);
      expect(result.comprehension).toBe(0);
    });

    it("should return fallback evidence on parse failure", async () => {
      vi.mocked(fetchFromAI).mockResolvedValue("invalid json");

      const result = await AssessmentService.extractEvidence("闭包", "定义", "Q", "A", "用户回答");

      expect(result.recall).toBe(0.3);
      expect(result.comprehension).toBe(0.3);
      expect(result.feedback).toContain("系统解析评估");
      expect(result.errorType).toBe("none");
    });

    it("should handle string scores", async () => {
      const aiResponse = JSON.stringify({
        recall: "0.9",
        comprehension: "0.7",
        application: "0.3",
        analysis: "0.6",
        feedback: "不错",
        errorType: "factual",
        suggestion: "多复习基础概念",
      });
      vi.mocked(fetchFromAI).mockResolvedValue(aiResponse);

      const result = await AssessmentService.extractEvidence("闭包", "定义", "Q", "A", "回答");

      expect(result.recall).toBe(0.9);
      expect(result.comprehension).toBe(0.7);
    });

    it("should handle missing optional fields with defaults", async () => {
      vi.mocked(fetchFromAI).mockResolvedValue(
        JSON.stringify({ recall: 0.5, comprehension: 0.5, application: 0.5, analysis: 0.5 }),
      );

      const result = await AssessmentService.extractEvidence("x", "y", "q", "a", "answer");

      expect(result.feedback).toBe("感谢你的作答。");
      expect(result.errorType).toBe("none");
      expect(result.suggestion).toBe("建议继续深入学习。");
    });
  });

  describe("optimizePrompt", () => {
    it("should trim quotes from optimized prompt", async () => {
      vi.mocked(fetchFromAI).mockResolvedValue('"请使用简单语言解释"');

      const result = await AssessmentService.optimizePrompt("简单点", "你是专家");

      expect(result).toBe("请使用简单语言解释");
    });

    it("should return trimmed result", async () => {
      vi.mocked(fetchFromAI).mockResolvedValue("  优化的指令内容  ");

      const result = await AssessmentService.optimizePrompt("test", "system");

      expect(result).toBe("优化的指令内容");
    });
  });
});
