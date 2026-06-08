import { create } from 'zustand';

import type { ToastPayload } from '@/types/toast';
import { triggerToastHaptic } from '@/utils/toast-haptics';

export type { ToastPayload } from '@/types/toast';
export type { ToastVariant } from '@/constants/toast-theme';

type ToastState = {
  toast: ToastPayload | null;
  visible: boolean;
  show: (input: ToastPayload) => void;
  hide: () => void;
};

const TOAST_MS = 2800;
const EXIT_MS = 240;

let hideTimer: ReturnType<typeof setTimeout> | undefined;
let clearTimer: ReturnType<typeof setTimeout> | undefined;

function clearTimers() {
  if (hideTimer) clearTimeout(hideTimer);
  if (clearTimer) clearTimeout(clearTimer);
  hideTimer = undefined;
  clearTimer = undefined;
}

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  visible: false,

  show: (input) => {
    const title = input.title.trim();
    if (!title) return;

    const toast: ToastPayload = {
      variant: input.variant,
      title,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(input.position ? { position: input.position } : {}),
    };

    triggerToastHaptic(toast.variant);
    clearTimers();
    set({ toast, visible: true });
    hideTimer = setTimeout(() => {
      hideTimer = undefined;
      set({ visible: false });
      clearTimer = setTimeout(() => {
        clearTimer = undefined;
        set({ toast: null });
      }, EXIT_MS);
    }, TOAST_MS);
  },

  hide: () => {
    clearTimers();
    set({ visible: false });
    clearTimer = setTimeout(() => {
      clearTimer = undefined;
      set({ toast: null });
    }, EXIT_MS);
  },
}));

/** Imperative toast — safe outside React (e.g. from stores). */
export function showToast(input: ToastPayload) {
  useToastStore.getState().show(input);
}
