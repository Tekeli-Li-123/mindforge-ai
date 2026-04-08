import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  DEFAULT_SYSTEM_PROMPT, 
  DEFAULT_REFINE_PROMPT, 
  DEFAULT_EXPLAIN_PROMPT, 
  DEFAULT_REORGANIZE_PROMPT 
} from '../config/prompts';

export type AIProvider = 'openai' | 'anthropic' | 'deepseek' | 'local';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  refinePrompt: string;
  explainPrompt: string;
  reorganizePrompt: string;
}

interface SettingsStore {
  aiSettings: AISettings;
  updateAISettings: (settings: Partial<AISettings>) => void;
  clearAISettings: () => void;
}

export const defaultAISettings: AISettings = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  refinePrompt: DEFAULT_REFINE_PROMPT,
  explainPrompt: DEFAULT_EXPLAIN_PROMPT,
  reorganizePrompt: DEFAULT_REORGANIZE_PROMPT
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
      name: 'mindforge-settings', // saved in localStorage under this key
    }
  )
);
