import { create } from 'zustand';

import { getCheckoutUnavailableCopy } from '@/utils/checkout-health';

type CheckoutUnavailableModalState = {
  visible: boolean;
  title: string;
  message: string;
  onTryAgain: (() => void) | null;
  show: (options?: { onTryAgain?: () => void }) => void;
  hide: () => void;
};

export const useCheckoutUnavailableModalStore = create<CheckoutUnavailableModalState>((set) => ({
  visible: false,
  title: '',
  message: '',
  onTryAgain: null,

  show: (options) => {
    const copy = getCheckoutUnavailableCopy();
    set({
      visible: true,
      title: copy.title,
      message: copy.message,
      onTryAgain: options?.onTryAgain ?? null,
    });
  },

  hide: () => {
    set({ visible: false, onTryAgain: null });
  },
}));

export function showCheckoutUnavailableModal(options?: { onTryAgain?: () => void }): void {
  useCheckoutUnavailableModalStore.getState().show(options);
}

export function hideCheckoutUnavailableModal(): void {
  useCheckoutUnavailableModalStore.getState().hide();
}
