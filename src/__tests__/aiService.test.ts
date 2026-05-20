import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildRequestBody,
  generateMindMap,
  fetchFromAI,
  explainConcept,
  chatWithAI,
  generateProjectPersona,
  reorganizeMindMap,
} from "../services/aiService";

import { detectModelCapabilities } from "../config/modelCapabilities";

// Mock stores
vi.mock("../stores/settingsStore", () => ({
  useSettingsStore: {
    getState: vi.fn(),
  },
  defaultAISettings: {
    systemPrompt: "默认系统提示",
    explainPrompt: "请用通俗的语言解释{{target}}，上下文：{{context}}",
    reorganizePrompt: "请重组以下内容：{{context}}\n\n{{childrenMarkdown}}",
  },
}));

vi.mock("../stores/mindmapStore", () => ({
  useMindMapStore: {
    getState: vi.fn(),
  },
}));

vi.mock("../services/skills", () => ({
  skillRegistry: {
    getSkillsPrompt: () => "可用指令列表",
  },
}));

vi.mock("../utils/mindmapHelpers", () => ({
  flattenNodesWithPaths: vi.fn(() => []),
}));

import { useSettingsStore } from "../stores/settingsStore";
import { useMindMapStore } from "../stores/mindmapStore";

const mockGetState = useSettingsStore.getState as ReturnType<typeof vi.fn>;
const mockMindMapGetState = useMindMapStore.getState as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();

  // Default mock state
  mockGetState.mockReturnValue({
    aiSettings: {
      provider: "openai",
      apiKey: "sk-test-key",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: "off",
      systemPrompt: "默认系统提示",
      explainPrompt: "请用通俗的语言解释{{target}}，上下文：{{context}}",
      reorganizePrompt: "请重组以下内容：{{context}}\n\n{{childrenMarkdown}}",
      customPayload: "",
    },
  });

  mockMindMapGetState.mockReturnValue({
    currentProject: null,
  });

  // Mock global fetch
  globalThis.fetch = vi.fn();
});

describe("buildRequestBody", () => {
  const baseMessages = [
    { role: "system", content: "You are helpful." },
    { role: "user", content: "Hello" },
  ];

  it("should build standard OpenAI request body", () => {
    const caps = detectModelCapabilities("gpt-4o", "openai");
    const body = buildRequestBody({
      messages: baseMessages,
      provider: "openai",
      model: "gpt-4o",
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: "off",
      caps,
    });

    expect(body.model).toBe("gpt-4o");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(4096);
  });

  it("should build Anthropic request body with system message", () => {
    const caps = detectModelCapabilities("claude-sonnet-4-5", "anthropic");
    const body = buildRequestBody({
      messages: baseMessages,
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: "medium",
      caps,
    });

    expect(body.model).toBe("claude-sonnet-4-5");
    expect(body.system).toBe("You are helpful.");
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(4096);
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.effort).toBe("medium");
  });

  it("should build Anthropic legacy budget thinking", () => {
    const caps = detectModelCapabilities("claude-3.7-sonnet", "anthropic");
    const body = buildRequestBody({
      messages: baseMessages,
      provider: "anthropic",
      model: "claude-3.7-sonnet",
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: "high",
      caps,
    });

    expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 16384 });
    expect(body.max_tokens).toBeGreaterThan(16384);
  });

  it("should convert system role to developer for o-series", () => {
    const caps = detectModelCapabilities("o4-mini", "openai");
    const body = buildRequestBody({
      messages: baseMessages,
      provider: "openai",
      model: "o4-mini",
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: "off",
      caps,
    });

    // o4 don't support temperature, so it should be omitted
    expect(body.temperature).toBeUndefined();
    expect(body.messages[0].role).toBe("developer");
  });

  it("should add reasoning_effort for reasoning models", () => {
    const caps = detectModelCapabilities("o4-mini", "openai");
    const body = buildRequestBody({
      messages: baseMessages,
      provider: "openai",
      model: "o4-mini",
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: "high",
      caps,
    });

    expect(body.reasoning_effort).toBe("high");
  });

  it("should not add reasoning_effort when reasoning is off", () => {
    const caps = detectModelCapabilities("o4-mini", "openai");
    const body = buildRequestBody({
      messages: baseMessages,
      provider: "openai",
      model: "o4-mini",
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: "off",
      caps,
    });

    expect(body.reasoning_effort).toBeUndefined();
  });

  it("should add thinking.enabled for DeepSeek reasoning", () => {
    const caps = detectModelCapabilities("deepseek-v4-pro", "deepseek");
    const body = buildRequestBody({
      messages: baseMessages,
      provider: "deepseek",
      model: "deepseek-v4-pro",
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: "medium",
      caps,
    });

    expect(body.thinking).toEqual({ type: "enabled" });
    expect(body.reasoning_effort).toBe("medium");
  });
});

describe("fetchFromAI", () => {
  it("should throw error when API key is missing", async () => {
    mockGetState.mockReturnValue({
      aiSettings: {
        provider: "openai",
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
        temperature: 0.7,
        maxTokens: 4096,
        reasoningEffort: "off",
        systemPrompt: "",
        explainPrompt: "",
        reorganizePrompt: "",
        customPayload: "",
      },
    });

    await expect(fetchFromAI("system", "user")).rejects.toThrow("API Key");
  });

  it("should not require API key for local provider", async () => {
    mockGetState.mockReturnValue({
      aiSettings: {
        provider: "local",
        apiKey: "",
        baseUrl: "http://localhost:1234/v1",
        model: "local-model",
        temperature: 0.7,
        maxTokens: 4096,
        reasoningEffort: "off",
        systemPrompt: "",
        explainPrompt: "",
        reorganizePrompt: "",
        customPayload: "",
      },
    });

    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello from local AI!" } }],
      }),
    });

    const result = await fetchFromAI("system prompt", "user message");
    expect(result).toBe("Hello from local AI!");
  });

  it("should successfully fetch from AI and return content", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "This is the response content." } }],
      }),
    });

    const result = await fetchFromAI("system prompt", "user message");
    expect(result).toBe("This is the response content.");
  });

  it("should handle API error responses", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(fetchFromAI("system", "user")).rejects.toThrow("API 请求失败");
  });

  it("should handle 400 with fallback retry", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad request - unsupported parameter",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Fallback response" } }],
        }),
      });

    const result = await fetchFromAI("system", "user");
    expect(result).toBe("Fallback response");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should throw if fallback also fails", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad request",
    });

    await expect(fetchFromAI("system", "user")).rejects.toThrow("API 请求失败");
  });
});

describe("generateMindMap", () => {
  it("should send generate mind map request", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "# Generated Mind Map\n- Node 1\n- Node 2" } }],
      }),
    });

    const result = await generateMindMap({ prompt: "Machine Learning" });
    expect(result).toContain("# Generated Mind Map");
  });

  it("should include title and description in request", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "# ML Basics\n- Supervised\n- Unsupervised" } }],
      }),
    });

    await generateMindMap({
      prompt: "ML Basics",
      title: "机器学习入门",
      description: "适合初学者",
    });

    expect(mockFetch).toHaveBeenCalled();
  });
});

describe("explainConcept", () => {
  it("should use default explain prompt when no AI config", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "闭包是函数与其词法环境的组合。" } }],
      }),
    });

    const result = await explainConcept("闭包", "JavaScript > 函数");
    expect(result).toBe("闭包是函数与其词法环境的组合。");
  });

  it("should append style instructions for beginner", async () => {
    mockMindMapGetState.mockReturnValue({
      currentProject: {
        title: "JS学习",
        aiConfig: {
          persona: "耐心的导师",
          explainStyle: "beginner",
        },
        root: { id: "root", content: "root", depth: 0, mastery: 0, expanded: false, children: [] },
      },
    });

    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "通俗解释" } }],
      }),
    });

    const result = await explainConcept("闭包", "JS");
    expect(result).toBe("通俗解释");
  });
});

describe("generateProjectPersona", () => {
  it("should generate persona from AI response", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"persona":"专业的导师","explainStyle":"expert"}' } }],
      }),
    });

    const result = await generateProjectPersona("学习AI", "机器学习", "像老师一样");
    expect(result.persona).toBe("专业的导师");
    expect(result.explainStyle).toBe("expert");
  });

  it("should strip markdown code blocks from JSON", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: '```json\n{"persona":"导师","explainStyle":"intermediate"}\n```' },
          },
        ],
      }),
    });

    const result = await generateProjectPersona("test", "AI", "");
    expect(result.persona).toBe("导师");
  });

  it("should throw on invalid JSON", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json at all" } }],
      }),
    });

    await expect(generateProjectPersona("test", "AI", "")).rejects.toThrow("格式不正确");
  });
});

describe("reorganizeMindMap", () => {
  it("should call AI to reorganize mind map", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "- Item 1\n- Item 2\n- Item 3" } }],
      }),
    });

    const result = await reorganizeMindMap("- A\n- B", "ML");
    expect(result).toContain("Item 1");
  });

  it("should strip markdown code fences", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "```markdown\n- A\n- B\n```" } }],
      }),
    });

    const result = await reorganizeMindMap("- X", "test");
    expect(result).not.toContain("```markdown");
  });
});

describe("chatWithAI", () => {
  it("should throw error when API key missing", async () => {
    mockGetState.mockReturnValue({
      aiSettings: {
        provider: "openai",
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
        temperature: 0.7,
        maxTokens: 4096,
        reasoningEffort: "off",
        systemPrompt: "",
        explainPrompt: "",
        reorganizePrompt: "",
        customPayload: "",
      },
    });

    await expect(
      chatWithAI([{ role: "user", content: "Hello", id: "1", timestamp: 1000 }]),
    ).rejects.toThrow("API Key");
  });

  it("should send chat messages and return response", async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello! How can I help you?" } }],
      }),
    });

    const result = await chatWithAI([{ role: "user", content: "Hello", id: "1", timestamp: 1000 }]);

    expect(result.content).toBe("Hello! How can I help you?");
  });

  it("should include context node information", async () => {
    mockMindMapGetState.mockReturnValue({
      currentProject: {
        title: "Test Project",
        root: {
          id: "root",
          content: "Root",
          depth: 0,
          mastery: 0,
          expanded: false,
          children: [
            {
              id: "child1",
              content: "Child Node",
              depth: 1,
              mastery: 0,
              expanded: false,
              children: [],
              note: "This is a note",
            },
          ],
        },
      },
    });

    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Based on the context..." } }],
      }),
    });

    const result = await chatWithAI(
      [{ role: "user", content: "Explain", id: "1", timestamp: 1000 }],
      { id: "child1", content: "Child Node", depth: 1, mastery: 0, expanded: false, children: [] },
      "Root > Child Node",
    );

    expect(result.content).toBe("Based on the context...");
  });
});
