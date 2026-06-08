import type { ToastVariant } from '@/constants/toast-theme';

export type ToastPosition = 'top' | 'bottom';

export type ToastPayload = {
  variant: ToastVariant;
  title: string;
  description?: string;
  position?: ToastPosition;
};
