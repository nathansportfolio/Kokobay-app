import { router } from 'expo-router';
import { Linking } from 'react-native';

import { markCheckoutTiming, startCheckoutTiming } from '@/lib/checkout-timing';
import {
  logCheckoutTrace,
  startCheckoutTrace,
} from '@/lib/checkout-trace';
import { setCheckoutPreSyncToken } from '@/lib/checkout-session';
import { trackBeginCheckout } from '@/lib/gtm';
import { cartEngine } from '@/src/core/cart';
import { isRemoteCartConfigured } from '@/services/cart/remote-cart';
import { getCartRevisionSnapshot } from '@/store/cart';
import { useAuthStore, useCartStore } from '@/store';
import { loadCartGuestId } from '@/store/cart-persist';
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
  startCheckoutTiming();
  startCheckoutTrace();

  const guestId = await loadCartGuestId();
  const initialCart = useCartStore.getState();
  const { cartRevision } = getCartRevisionSnapshot();

  logCheckoutTrace('checkout_button_pressed', {
    guestId,
    shopifyCartId: initialCart.shopifyCartId,
    cartRevision,
    lineCount: initialCart.lines.length,
    checkoutUrl: initialCart.storeCheckoutUrl ?? initialCart.checkoutUrl,
  });

  const customerEmail = useAuthStore.getState().user?.email?.trim();
  logCheckoutTrace('checkout_sync_start', {
    guestId,
    shopifyCartId: initialCart.shopifyCartId,
    cartRevision,
  });
  markCheckoutTiming('checkout_sync_started');
  const synced = await cartEngine.checkout(customerEmail ?? undefined);
  markCheckoutTiming('checkout_sync_finished');

  const afterSync = useCartStore.getState();
  const { cartRevision: cartRevisionAfterSync } = getCartRevisionSnapshot();
  logCheckoutTrace('checkout_sync_complete', {
    guestId,
    ok: synced,
    shopifyCartId: afterSync.shopifyCartId,
    cartRevision: cartRevisionAfterSync,
    lineCount: afterSync.lines.length,
    checkoutUrl: afterSync.storeCheckoutUrl ?? afterSync.checkoutUrl,
  });

  if (!synced && isRemoteCartConfigured()) {
    showCheckoutUnavailableModal({
      onTryAgain: () => {
        void openCheckoutFromBag();
      },
    });
    return 'unavailable';
  }

  const checkoutUrl = getCheckoutUrl();
  markCheckoutTiming('checkout_url_ready');
  logCheckoutTrace('checkout_url_ready', {
    guestId,
    shopifyCartId: afterSync.shopifyCartId,
    cartRevision: cartRevisionAfterSync,
    checkoutUrl,
  });

  if (!assertCheckoutAvailable(checkoutUrl, { source: 'openCheckoutFromBag' })) {
    showCheckoutUnavailableModal({
      onTryAgain: () => {
        void openCheckoutFromBag();
      },
    });
    return 'unavailable';
  }

  trackBeginCheckout(afterSync.lines);

  try {
    markCheckoutTiming('checkout_navigation_start');
    logCheckoutTrace('checkout_navigate', {
      guestId,
      shopifyCartId: afterSync.shopifyCartId,
      checkoutUrl,
    });
    setCheckoutPreSyncToken(cartRevisionAfterSync);
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
