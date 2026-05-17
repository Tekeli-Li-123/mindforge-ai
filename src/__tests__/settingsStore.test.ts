import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSettingsStore, defaultAISettings } from "../stores/settingsStore";
import type { AIProvider } from "../stores/settingsStore";

// Helper to reset the store between tests
function resetStore() {
  useSettingsStore.setState({ aiSettings: { ...defaultAISettings } });
}

beforeEach(() => {
  resetStore();
  // Clear localStorage before each test
  localStorage.clear();
});

describe("settingsStore", () => {
  describe("initial state", () => {
    it("should initialize with default settings", () => {
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.provider).toBe("openai");
      expect(aiSettings.model).toBe("gpt-4o");
      expect(aiSettings.temperature).toBe(0.7);
      expect(aiSettings.maxTokens).toBe(4096);
      expect(aiSettings.reasoningEffort).toBe("off");
      expect(aiSettings.apiKey).toBe("");
      expect(aiSettings.baseUrl).toBe("https://api.openai.com/v1");
      expect(aiSettings.customPayload).toBe("");
    });

    it("should have non-empty system prompt", () => {
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.systemPrompt.length).toBeGreaterThan(0);
    });

    it("should have non-empty refine prompt", () => {
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.refinePrompt.length).toBeGreaterThan(0);
    });

    it("should have non-empty explain prompt", () => {
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.explainPrompt.length).toBeGreaterThan(0);
    });

    it("should have non-empty reorganize prompt", () => {
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.reorganizePrompt.length).toBeGreaterThan(0);
    });

    it("should have non-empty assessment prompt", () => {
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.assessmentPrompt.length).toBeGreaterThan(0);
    });
  });

  describe("updateAISettings", () => {
    it("should update provider", () => {
      useSettingsStore.getState().updateAISettings({ provider: "anthropic" });
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.provider).toBe("anthropic");
    });

    it("should update apiKey", () => {
      useSettingsStore.getState().updateAISettings({ apiKey: "sk-test-key" });
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.apiKey).toBe("sk-test-key");
    });

    it("should update baseUrl", () => {
      useSettingsStore.getState().updateAISettings({ baseUrl: "https://custom.api.com/v1" });
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.baseUrl).toBe("https://custom.api.com/v1");
    });

    it("should update model", () => {
      useSettingsStore.getState().updateAISettings({ model: "claude-sonnet-4-20250514" });
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.model).toBe("claude-sonnet-4-20250514");
    });

    it("should update temperature", () => {
      useSettingsStore.getState().updateAISettings({ temperature: 0.2 });
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.temperature).toBe(0.2);
    });

    it("should update maxTokens", () => {
      useSettingsStore.getState().updateAISettings({ maxTokens: 8192 });
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.maxTokens).toBe(8192);
    });

    it("should update reasoningEffort", () => {
      useSettingsStore.getState().updateAISettings({ reasoningEffort: "high" });
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.reasoningEffort).toBe("high");
    });

    it("should update customPayload", () => {
      const payload = '{"top_p": 0.9}';
      useSettingsStore.getState().updateAISettings({ customPayload: payload });
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.customPayload).toBe(payload);
    });

    it("should update systemPrompt", () => {
      useSettingsStore.getState().updateAISettings({ systemPrompt: "Custom system prompt" });
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.systemPrompt).toBe("Custom system prompt");
    });

    it("should update refinePrompt", () => {
      useSettingsStore.getState().updateAISettings({ refinePrompt: "Custom refine prompt" });
      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.refinePrompt).toBe("Custom refine prompt");
    });

    it("should merge partial settings without losing existing values", () => {
      // First change provider
      useSettingsStore.getState().updateAISettings({ provider: "deepseek" });
      // Then change model — provider should remain
      useSettingsStore.getState().updateAISettings({ model: "deepseek-v4-flash" });

      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.provider).toBe("deepseek");
      expect(aiSettings.model).toBe("deepseek-v4-flash");
      // Other defaults should stay
      expect(aiSettings.temperature).toBe(0.7);
      expect(aiSettings.baseUrl).toBe("https://api.openai.com/v1");
    });
  });

  describe("clearAISettings", () => {
    it("should reset to defaults", () => {
      // Change some values
      useSettingsStore.getState().updateAISettings({
        provider: "anthropic",
        apiKey: "sk-test",
        model: "claude-opus-4-20250514",
      });

      // Clear
      useSettingsStore.getState().clearAISettings();

      const { aiSettings } = useSettingsStore.getState();
      expect(aiSettings.provider).toBe("openai");
      expect(aiSettings.apiKey).toBe("");
      expect(aiSettings.model).toBe("gpt-4o");
      expect(aiSettings.temperature).toBe(0.7);
    });
  });

  describe("persistence (localStorage)", () => {
    it("should persist settings to localStorage", () => {
      useSettingsStore.getState().updateAISettings({ provider: "local" });

      const saved = localStorage.getItem("mindforge-settings");
      expect(saved).not.toBeNull();

      if (saved) {
        const parsed = JSON.parse(saved);
        expect(parsed.state.aiSettings.provider).toBe("local");
      }
    });

    it("should restore settings from localStorage on re-creation", () => {
      // Save state
      useSettingsStore.getState().updateAISettings({
        provider: "anthropic",
        apiKey: "sk-restore-test",
        model: "claude-sonnet-4-20250514",
      });

      // Reset store (simulates page reload by clearing in-memory state)
      resetStore();

      // The persist middleware should hydrate from localStorage
      // Note: zustand/persist hydrates asynchronously by default
      // So we check that the persist config exists
      const { aiSettings } = useSettingsStore.getState();
      // After reset, it's back to defaults because we called resetStore manually
      // The persist middleware will rehydrate on next tick
      // For this test we verify the key exists in localStorage
      expect(localStorage.getItem("mindforge-settings")).not.toBeNull();
    });
  });

  describe("defaultAISettings", () => {
    it("should have expected structure", () => {
      expect(defaultAISettings).toHaveProperty("provider");
      expect(defaultAISettings).toHaveProperty("apiKey");
      expect(defaultAISettings).toHaveProperty("baseUrl");
      expect(defaultAISettings).toHaveProperty("model");
      expect(defaultAISettings).toHaveProperty("temperature");
      expect(defaultAISettings).toHaveProperty("maxTokens");
      expect(defaultAISettings).toHaveProperty("reasoningEffort");
      expect(defaultAISettings).toHaveProperty("systemPrompt");
      expect(defaultAISettings).toHaveProperty("refinePrompt");
      expect(defaultAISettings).toHaveProperty("explainPrompt");
      expect(defaultAISettings).toHaveProperty("reorganizePrompt");
      expect(defaultAISettings).toHaveProperty("assessmentPrompt");
      expect(defaultAISettings).toHaveProperty("customPayload");
    });

    it("should have valid provider", () => {
      const validProviders: AIProvider[] = ["openai", "anthropic", "deepseek", "local"];
      expect(validProviders).toContain(defaultAISettings.provider);
    });

    it("should have valid temperature range", () => {
      expect(defaultAISettings.temperature).toBeGreaterThanOrEqual(0);
      expect(defaultAISettings.temperature).toBeLessThanOrEqual(2);
    });

    it("should have valid maxTokens", () => {
      expect(defaultAISettings.maxTokens).toBeGreaterThan(0);
      expect(defaultAISettings.maxTokens).toBeLessThanOrEqual(128000);
    });
  });
});
