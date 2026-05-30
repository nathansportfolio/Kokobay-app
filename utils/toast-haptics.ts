import type { ToastVariant } from '@/constants/toast-theme';
import { hapticError, hapticSuccess, hapticWarning } from '@/utils/haptics';

export function triggerToastHaptic(variant: ToastVariant): void {
  switch (variant) {
    case 'success':
      hapticSuccess();
      break;
    case 'warning':
      hapticWarning();
      break;
    case 'error':
      hapticError();
      break;
    case 'info':
      break;
  }
}
