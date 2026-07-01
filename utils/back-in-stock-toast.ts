import type { BackInStockSubscribeResult } from '@/services/kokobay-web/back-in-stock';
import { showToast } from '@/store/toast';

/** RN Modal layers above root ToastHost — defer until the sheet has unmounted. */
export function deferBackInStockToast(show: () => void, delayMs = 180): void {
  setTimeout(show, delayMs);
}

export function showBackInStockResultToast(
  result: BackInStockSubscribeResult,
  position: 'bottom' | 'top' = 'bottom',
): void {
  if (!result.ok) {
    showToast({
      variant: 'error',
      title: 'Could not save alert',
      description: result.error,
      position,
    });
    return;
  }

  showToast(
    result.alreadySubscribed
      ? {
          variant: 'info',
          title: 'Already on the list',
          description: 'We will email you when this piece is back.',
          position,
        }
      : {
          variant: 'success',
          title: 'You\u2019re on the list',
          description: 'We\u2019ll email you when this piece is back.',
          position,
        },
  );
}
