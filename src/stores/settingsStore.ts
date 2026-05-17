import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_REFINE_PROMPT,
  DEFAULT_EXPLAIN_PROMPT,
  DEFAULT_REORGANIZE_PROMPT,
  DEFAULT_ASSESSMENT_PROMPT,
} from "../config/prompts";

export type AIProvider = "openai" | "anthropic" | "deepseek" | "local";

export type ReasoningEffort = "off" | "low" | "medium" | "high";

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  // 推理与生成控制
  temperature: number;
  maxTokens: number;
  reasoningEffort: ReasoningEffort;
  // Prompt 模板
  systemPrompt: string;
  refinePrompt: string;
  explainPrompt: string;
  reorganizePrompt: string;
  assessmentPrompt: string;
  // 高级自定义参数 (JSON String)
  customPayload?: string;
}

interface SettingsStore {
  aiSettings: AISettings;
  updateAISettings: (settings: Partial<AISettings>) => void;
  clearAISettings: () => void;
}

export const defaultAISettings: AISettings = {
  provider: "openai",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
  temperature: 0.7,
  maxTokens: 4096,
  reasoningEffort: "off",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  refinePrompt: DEFAULT_REFINE_PROMPT,
  explainPrompt: DEFAULT_EXPLAIN_PROMPT,
  reorganizePrompt: DEFAULT_REORGANIZE_PROMPT,
  assessmentPrompt: DEFAULT_ASSESSMENT_PROMPT,
  customPayload: "",
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      aiSettings: defaultAISettings,

      updateAISettings: (settings) =>
        set((state) => ({
          aiSettings: {
            ...state.aiSettings,
            ...settings,
          },
        })),

      clearAISettings: () => set({ aiSettings: defaultAISettings }),
    }),
    {
      name: "mindforge-settings", // saved in localStorage under this key
    },
  ),
);
