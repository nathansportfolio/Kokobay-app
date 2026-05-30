import type { CartSyncError } from '@/services/cart/sync';
import type { CartLine } from '@/types/cart';
import type { ToastPayload } from '@/types/toast';

export function cartSyncErrorToast(syncError: CartSyncError, lines: CartLine[]): ToastPayload {
  if (syncError.code === 'insufficient_inventory') {
    if (lines.length === 1) {
      const qty = lines[0].qty;
      return {
        variant: 'warning',
        title:
          qty === 1
            ? 'Only 1 in your bag'
            : `Only ${qty} in your bag`,
        description: 'Not enough stock for more',
      };
    }
    const total = lines.reduce((sum, line) => sum + line.qty, 0);
    return {
      variant: 'warning',
      title: total === 1 ? 'Only 1 item kept in your bag' : `Only ${total} items kept in your bag`,
      description: 'Not enough stock for more',
    };
  }
  return {
    variant: 'error',
    title: syncError.message.trim() || 'Could not update your bag',
  };
}
