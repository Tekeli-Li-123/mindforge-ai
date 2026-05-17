import { describe, it, expect } from "vitest";
import { detectModelCapabilities, getMatchedRuleLabel } from "../config/modelCapabilities";

describe("detectModelCapabilities", () => {
  describe("OpenAI models", () => {
    it("should detect o-series reasoning models", () => {
      const caps = detectModelCapabilities("o4-mini", "openai");
      expect(caps.isReasoning).toBe(true);
      expect(caps.supportsTemperature).toBe(false);
      expect(caps.supportsSystemRole).toBe(false);
      expect(caps.reasoningControl).toBe("effort");
      expect(caps.systemRoleAlternative).toBe("developer");
    });

    it("should detect o1 series reasoning models", () => {
      const caps = detectModelCapabilities("o1-preview", "openai");
      expect(caps.isReasoning).toBe(true);
      expect(caps.supportsSystemRole).toBe(false);
    });

    it("should detect GPT-5 Thinking models", () => {
      const caps = detectModelCapabilities("gpt-5-thinking", "openai");
      expect(caps.isReasoning).toBe(true);
      expect(caps.supportsTemperature).toBe(false);
    });

    it("should return defaults for standard GPT models", () => {
      const caps = detectModelCapabilities("gpt-4o", "openai");
      expect(caps.isReasoning).toBe(false);
      expect(caps.supportsTemperature).toBe(true);
      expect(caps.supportsSystemRole).toBe(true);
      expect(caps.reasoningControl).toBe("none");
    });
  });

  describe("Anthropic Claude models", () => {
    it("should detect Claude 4.5+ with adaptive thinking", () => {
      const caps = detectModelCapabilities("claude-sonnet-4-5", "anthropic");
      expect(caps.isReasoning).toBe(true);
      expect(caps.reasoningControl).toBe("effort");
      expect(caps.useNativeAnthropicAPI).toBe(true);
      expect(caps.supportsTemperature).toBe(true);
    });

    it("should detect Claude 3.7 with budget thinking", () => {
      const caps = detectModelCapabilities("claude-3.7-sonnet", "anthropic");
      expect(caps.isReasoning).toBe(true);
      expect(caps.reasoningControl).toBe("budget");
      expect(caps.useNativeAnthropicAPI).toBe(true);
    });

    it("should detect Claude 3.7 legacy version", () => {
      const caps = detectModelCapabilities("claude-3-7-sonnet-20250219", "anthropic");
      expect(caps.isReasoning).toBe(true);
    });

    it("should treat standard Claude as non-reasoning", () => {
      const caps = detectModelCapabilities("claude-3-haiku", "anthropic");
      expect(caps.isReasoning).toBe(false);
      expect(caps.useNativeAnthropicAPI).toBe(true);
    });

    it("should detect Claude 4.6+ major version", () => {
      const caps = detectModelCapabilities("claude-opus-4-6", "anthropic");
      expect(caps.isReasoning).toBe(true);
      expect(caps.reasoningControl).toBe("effort");
    });

    it("should detect Claude 5.x reasoning", () => {
      const caps = detectModelCapabilities("claude-5-sonnet", "anthropic");
      expect(caps.isReasoning).toBe(true);
    });
  });

  describe("DeepSeek models", () => {
    it("should detect V4 Pro reasoning mode", () => {
      const caps = detectModelCapabilities("deepseek-v4-pro", "deepseek");
      expect(caps.isReasoning).toBe(true);
      expect(caps.responseReasoningField).toBe("reasoning_content");
      expect(caps.supportsTemperature).toBe(false);
    });

    it("should detect V4Pro without hyphen", () => {
      const caps = detectModelCapabilities("deepseek-v4pro", "deepseek");
      expect(caps.isReasoning).toBe(true);
    });

    it("should detect DeepSeek R1 Reasoner", () => {
      const caps = detectModelCapabilities("deepseek-r1", "deepseek");
      expect(caps.isReasoning).toBe(true);
      expect(caps.responseReasoningField).toBe("reasoning_content");
    });

    it("should detect DeepSeek Reasoner explicit", () => {
      const caps = detectModelCapabilities("deepseek-reasoner", "deepseek");
      expect(caps.isReasoning).toBe(true);
    });

    it("should return defaults for standard DeepSeek models", () => {
      const caps = detectModelCapabilities("deepseek-chat", "deepseek");
      expect(caps.isReasoning).toBe(false);
      expect(caps.supportsTemperature).toBe(true);
    });

    it("should detect V4 Flash as non-reasoning", () => {
      const caps = detectModelCapabilities("deepseek-v4-flash", "deepseek");
      expect(caps.isReasoning).toBe(false);
    });
  });

  describe("Local / unknown providers", () => {
    it("should return defaults for local provider", () => {
      const caps = detectModelCapabilities("qwen2.5-7b", "local");
      expect(caps.isReasoning).toBe(false);
      expect(caps.supportsTemperature).toBe(true);
      expect(caps.supportsSystemRole).toBe(true);
      expect(caps.reasoningControl).toBe("none");
    });

    it("should return defaults for unknown model", () => {
      const caps = detectModelCapabilities("random-model", "unknown");
      expect(caps.isReasoning).toBe(false);
      expect(caps.supportsTemperature).toBe(true);
    });

    it("should be case-insensitive for model names", () => {
      const caps1 = detectModelCapabilities("O4-MINI", "OPENAI");
      expect(caps1.isReasoning).toBe(true);

      const caps2 = detectModelCapabilities("CLAUDE-3.7-SONNET", "ANTHROPIC");
      expect(caps2.isReasoning).toBe(true);
    });
  });
});

describe("getMatchedRuleLabel", () => {
  it("should return label for known model", () => {
    const label = getMatchedRuleLabel("o4-mini", "openai");
    expect(label).toContain("推理模型");
  });

  it("should return label for Claude 3.7", () => {
    const label = getMatchedRuleLabel("claude-3.7-sonnet", "anthropic");
    expect(label).toContain("Extended Thinking");
  });

  it("should return label for DeepSeek V4 Pro", () => {
    const label = getMatchedRuleLabel("deepseek-v4-pro", "deepseek");
    expect(label).toContain("V4 Pro");
  });

  it("should return null for unknown model", () => {
    const label = getMatchedRuleLabel("unknown-model", "unknown");
    expect(label).toBeNull();
  });
});
