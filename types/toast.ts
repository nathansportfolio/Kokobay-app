import type { ToastVariant } from '@/constants/toast-theme';

export type ToastPayload = {
  variant: ToastVariant;
  title: string;
  description?: string;
};
