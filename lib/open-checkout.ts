import { router } from 'expo-router';
import { Linking } from 'react-native';

import { trackBeginCheckout } from '@/lib/gtm';
import { cartEngine } from '@/src/core/cart';
import { useAuthStore, useCartStore } from '@/store';
import { showCheckoutUnavailableModal } from '@/store/checkout-unavailable-modal';
import { resolveCheckoutWebViewUrl } from '@/utils/checkout-url';
import {
  assertCheckoutAvailable,
  logCheckoutHealth,
} from '@/utils/checkout-health';

/** Resolved WebView entry URL after cart sync (Storefront checkout or permalink fallback). */
export function getCheckoutUrl(): string | null {
  const { lines, checkoutUrl, storeCheckoutUrl } = useCartStore.getState();
  const customerEmail = useAuthStore.getState().user?.email?.trim();
  const storeCheckout = storeCheckoutUrl ?? checkoutUrl;
  return resolveCheckoutWebViewUrl(storeCheckout, lines, {
    isLoggedIn: Boolean(customerEmail),
    awaitingCheckoutUrl: false,
  });
}

export type OpenCheckoutFromBagResult = 'opened_in_app' | 'opened_external' | 'unavailable';

async function tryOpenCheckoutExternally(url: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      throw new Error('Linking.canOpenURL returned false');
    }
    await Linking.openURL(url);
    return true;
  } catch (error) {
    logCheckoutHealth('open_failed', {
      url,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Sync cart, validate checkout URL health, then open in-app checkout or external browser.
 */
export async function openCheckoutFromBag(): Promise<OpenCheckoutFromBagResult> {
  const customerEmail = useAuthStore.getState().user?.email?.trim();
  const synced = await cartEngine.checkout(customerEmail ?? undefined);
  if (!synced && isRemoteCartConfigured()) {
    showCheckoutUnavailableModal({
      onTryAgain: () => {
        void openCheckoutFromBag();
      },
    });
    return 'unavailable';
  }

  const checkoutUrl = getCheckoutUrl();
  if (!assertCheckoutAvailable(checkoutUrl, { source: 'openCheckoutFromBag' })) {
    showCheckoutUnavailableModal({
      onTryAgain: () => {
        void openCheckoutFromBag();
      },
    });
    return 'unavailable';
  }

  const lines = useCartStore.getState().lines;
  trackBeginCheckout(lines);

  try {
    router.push('/cart/checkout');
    return 'opened_in_app';
  } catch (error) {
    logCheckoutHealth('open_failed', {
      url: checkoutUrl,
      source: 'router.push',
      message: error instanceof Error ? error.message : String(error),
    });
    const opened = await tryOpenCheckoutExternally(checkoutUrl);
    if (opened) {
      return 'opened_external';
    }
    showCheckoutUnavailableModal({
      onTryAgain: () => {
        void openCheckoutFromBag();
      },
    });
    return 'unavailable';
  }
}

/** External browser fallback when the in-app WebView cannot load checkout. */
export async function openCheckoutExternallyOrShowUnavailable(
  url: string,
  options?: { onTryAgain?: () => void },
): Promise<boolean> {
  if (!assertCheckoutAvailable(url, { source: 'openCheckoutExternally' })) {
    showCheckoutUnavailableModal({
      onTryAgain: options?.onTryAgain,
    });
    return false;
  }

  const opened = await tryOpenCheckoutExternally(url);
  if (opened) {
    return true;
  }

  showCheckoutUnavailableModal({
    onTryAgain: options?.onTryAgain,
  });
  return false;
}
