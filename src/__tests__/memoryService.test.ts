import { describe, it, expect, beforeEach, vi } from "vitest";
import { memoryService } from "../services/memoryService";
import { useSettingsStore } from "../stores/settingsStore";
import type { ChatMessage, MindMapNode } from "../types";

// Mock useSettingsStore for apiKey/provider checks
vi.mock("../stores/settingsStore", () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      aiSettings: {
        provider: "openai",
        apiKey: "sk-test-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
        temperature: 0.7,
        maxTokens: 4096,
        reasoningEffort: "off",
        systemPrompt: "",
        explainPrompt: "",
        refinePrompt: "",
        reorganizePrompt: "",
        customPayload: "",
      },
    })),
  },
}));

function createSampleMessages(): ChatMessage[] {
  return [
    { id: "1", role: "user", content: "什么是闭包？", timestamp: 1000 },
    {
      id: "2",
      role: "assistant",
      content: "闭包是指有权访问另一个函数作用域中变量的函数。",
      timestamp: 2000,
    },
    { id: "3", role: "user", content: "能举个例子吗？", timestamp: 3000 },
    {
      id: "4",
      role: "assistant",
      content: "例如：function outer() { let x = 1; return function inner() { console.log(x); } }",
      timestamp: 4000,
    },
    {
      id: "5",
      role: "user",
      content: "我理解了，闭包就是函数 + 它捕获的变量环境。",
      timestamp: 5000,
    },
    { id: "6", role: "assistant", content: "没错！你总结得很到位。", timestamp: 6000 },
  ];
}

function createSampleNodes(): MindMapNode[] {
  return [
    { id: "node-1", content: "闭包", depth: 0, mastery: 0, expanded: true, children: [] },
    { id: "node-2", content: "作用域链", depth: 0, mastery: 0, expanded: true, children: [] },
  ];
}

// Helper to mock a successful fetch response
function mockFetchResponse(responseData: unknown, ok = true) {
  return vi.mocked(fetch).mockResolvedValueOnce({
    ok,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(responseData) } }],
    }),
  } as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = vi.fn() as any;
});

describe("memoryService", () => {
  describe("estimateTokens", () => {
    it("should estimate 0 tokens for empty messages", () => {
      expect(memoryService.estimateTokens([])).toBe(0);
    });

    it("should estimate tokens based on content length", () => {
      const messages: ChatMessage[] = [
        { id: "1", role: "user", content: "你好世界", timestamp: 1000 },
      ];
      // 4 chars * 0.8 = 3.2 → ceil → 4
      expect(memoryService.estimateTokens(messages)).toBe(4);
    });

    it("should accumulate tokens across multiple messages", () => {
      const messages: ChatMessage[] = [
        { id: "1", role: "user", content: "Hello", timestamp: 1000 }, // 5 chars
        { id: "2", role: "assistant", content: "World!", timestamp: 2000 }, // 6 chars
      ];
      // 11 * 0.8 = 8.8 → ceil → 9
      expect(memoryService.estimateTokens(messages)).toBe(9);
    });

    it("should handle long messages", () => {
      const longContent = "A".repeat(1000);
      const messages: ChatMessage[] = [
        { id: "1", role: "user", content: longContent, timestamp: 1000 },
      ];
      // 1000 * 0.8 = 800
      expect(memoryService.estimateTokens(messages)).toBe(800);
    });
  });

  describe("extractInsights", () => {
    it("should return empty when no apiKey and provider is not local", async () => {
      // Override mock to return empty apiKey for this test
      (useSettingsStore.getState as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        aiSettings: { provider: "openai", apiKey: "", baseUrl: "", model: "" },
      });

      const result = await memoryService.extractInsights(
        createSampleMessages(),
        createSampleNodes(),
      );

      expect(result).toEqual({ facts: [], masteryUpdates: [] });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should call fetch to get AI response", async () => {
      const mockResponse = {
        facts: ["闭包可以捕获外部变量"],
        masteryUpdates: [{ nodeId: "node-1", score: 0.8 }],
      };
      mockFetchResponse(mockResponse);

      const result = await memoryService.extractInsights(
        createSampleMessages(),
        createSampleNodes(),
      );

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.facts).toContain("闭包可以捕获外部变量");
    });

    it("should parse response correctly", async () => {
      const mockResponse = {
        facts: ["闭包是函数与词法环境的组合", "内层函数可以访问外层函数的变量"],
        masteryUpdates: [{ nodeId: "node-1", score: 0.85 }],
      };
      mockFetchResponse(mockResponse);

      const result = await memoryService.extractInsights(
        createSampleMessages(),
        createSampleNodes(),
      );

      expect(result.facts).toHaveLength(2);
      expect(result.facts[0]).toBe("闭包是函数与词法环境的组合");
      expect(result.masteryUpdates[0].nodeId).toBe("node-1");
      expect(result.masteryUpdates[0].score).toBe(0.85);
    });

    it("should handle JSON wrapped in markdown code blocks", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '```json\n{"facts": ["测试"], "masteryUpdates": []}\n```',
              },
            },
          ],
        }),
      } as Response);

      const result = await memoryService.extractInsights(
        createSampleMessages(),
        createSampleNodes(),
      );
      expect(result.facts).toEqual(["测试"]);
    });

    it("should handle fetch failure gracefully", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const result = await memoryService.extractInsights(
        createSampleMessages(),
        createSampleNodes(),
      );
      expect(result).toEqual({ facts: [], masteryUpdates: [] });
    });

    it("should handle non-ok response gracefully", async () => {
      mockFetchResponse({}, false);

      const result = await memoryService.extractInsights(
        createSampleMessages(),
        createSampleNodes(),
      );
      expect(result).toEqual({ facts: [], masteryUpdates: [] });
    });

    it("should set Authorization header when apiKey exists", async () => {
      mockFetchResponse({ facts: [], masteryUpdates: [] });

      await memoryService.extractInsights(createSampleMessages(), createSampleNodes());

      const callArgs = (fetch as any).mock.calls[0];
      expect(callArgs[1].headers.Authorization).toBe("Bearer sk-test-key");
    });

    it("should not include Authorization header for local provider", async () => {
      (useSettingsStore.getState as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        aiSettings: {
          provider: "local",
          apiKey: "",
          baseUrl: "http://localhost:1234/v1",
          model: "local-model",
        },
      });

      mockFetchResponse({ facts: [], masteryUpdates: [] });

      await memoryService.extractInsights(createSampleMessages(), createSampleNodes());

      const callArgs = (fetch as any).mock.calls[0];
      expect(callArgs[1].headers.Authorization).toBeUndefined();
    });
  });

  describe("summarizeHistory", () => {
    it("should return fallback message when no apiKey", async () => {
      (useSettingsStore.getState as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        aiSettings: { provider: "openai", apiKey: "", baseUrl: "", model: "" },
      });

      const result = await memoryService.summarizeHistory(createSampleMessages());
      expect(result).toBe("（压缩摘要失败）");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should call fetch to summarize", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "用户询问闭包，助手解释其概念并举例。" } }],
        }),
      } as Response);

      const result = await memoryService.summarizeHistory(createSampleMessages());

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result).toBe("用户询问闭包，助手解释其概念并举例。");
    });

    it("should handle fetch failure gracefully", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const result = await memoryService.summarizeHistory(createSampleMessages());
      expect(result).toBe("（压缩摘要失败）");
    });

    it("should pass the conversation history in the user message", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "摘要" } }],
        }),
      } as Response);

      await memoryService.summarizeHistory(createSampleMessages());

      const callArgs = (fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[1].content).toContain("user: 什么是闭包？");
      expect(body.messages[1].content).toContain("assistant: 没错！你总结得很到位。");
    });
  });
});
