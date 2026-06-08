import { create } from 'zustand';

import type {
  AppUpdatePromptKind,
  AppVersionCheckResult,
  AppVersionConfig,
} from '@/src/core/app-version/types';

type AppVersionStoreState = {
  status: 'idle' | 'ready';
  prompt: AppUpdatePromptKind;
  title: string;
  message: string;
  currentVersion: string;
  config: AppVersionConfig | null;
  optionalDismissed: boolean;
  applyCheckResult: (result: AppVersionCheckResult) => void;
  setPrompt: (prompt: AppUpdatePromptKind) => void;
};

export const useAppVersionStore = create<AppVersionStoreState>((set) => ({
  status: 'idle',
  prompt: 'none',
  title: '',
  message: '',
  currentVersion: '',
  config: null,
  optionalDismissed: false,

  applyCheckResult: (result) => {
    set({
      status: 'ready',
      prompt: result.prompt,
      title: result.config?.title ?? '',
      message: result.config?.message ?? '',
      currentVersion: result.currentVersion,
      config: result.config,
      optionalDismissed: result.optionalDismissed,
    });
  },

  setPrompt: (prompt) => {
    set({ prompt });
  },
}));

export function isAppUpdateBlocking(): boolean {
  return useAppVersionStore.getState().prompt === 'required';
}
