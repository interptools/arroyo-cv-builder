import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectSettings, CaptionStyle } from '../types';

interface SettingsState {
  // Global app settings
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoSave: boolean;
  autoSaveInterval: number; // milliseconds

  // AI settings
  geminiApiKey: string;
  elevenLabsApiKey: string;
  pexelsApiKey: string;
  useLocalModels: boolean;
  whisperModel: 'tiny' | 'base';
  llamaModel: string;

  // Default project settings
  defaultProjectSettings: ProjectSettings;

  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (language: string) => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;
  setGeminiApiKey: (key: string) => void;
  setElevenLabsApiKey: (key: string) => void;
  setPexelsApiKey: (key: string) => void;
  setUseLocalModels: (useLocal: boolean) => void;
  setWhisperModel: (model: 'tiny' | 'base') => void;
  setLlamaModel: (model: string) => void;
  updateDefaultProjectSettings: (settings: Partial<ProjectSettings>) => void;
  resetToDefaults: () => void;
}

const defaultCaptionStyle: CaptionStyle = {
  fontSize: 24,
  fontFamily: 'Inter, sans-serif',
  color: '#ffffff',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  position: 'bottom',
  animation: 'none',
};

const defaultProjectSettings: ProjectSettings = {
  captionStyle: defaultCaptionStyle,
  defaultVoice: 'en-US-1',
  brollSources: ['local', 'pexels'],
  exportQuality: '1080p',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'en',
      autoSave: true,
      autoSaveInterval: 30000,
      geminiApiKey: '',
      elevenLabsApiKey: '',
      pexelsApiKey: '',
      useLocalModels: true,
      whisperModel: 'tiny',
      llamaModel: 'ggml-tiny-llama.bin',
      defaultProjectSettings,

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setAutoSave: (autoSave) => set({ autoSave }),
      setAutoSaveInterval: (autoSaveInterval) => set({ autoSaveInterval }),
      setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
      setElevenLabsApiKey: (elevenLabsApiKey) => set({ elevenLabsApiKey }),
      setPexelsApiKey: (pexelsApiKey) => set({ pexelsApiKey }),
      setUseLocalModels: (useLocalModels) => set({ useLocalModels }),
      setWhisperModel: (whisperModel) => set({ whisperModel }),
      setLlamaModel: (llamaModel) => set({ llamaModel }),
      updateDefaultProjectSettings: (settings) =>
        set((state) => ({
          defaultProjectSettings: { ...state.defaultProjectSettings, ...settings },
        })),
      resetToDefaults: () =>
        set({
          theme: 'system',
          language: 'en',
          autoSave: true,
          autoSaveInterval: 30000,
          geminiApiKey: '',
          elevenLabsApiKey: '',
          pexelsApiKey: '',
          useLocalModels: true,
          whisperModel: 'tiny',
          llamaModel: 'ggml-tiny-llama.bin',
          defaultProjectSettings,
        }),
    }),
    {
      name: 'video-editor-settings',
    }
  )
);