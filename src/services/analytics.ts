import type { GtmDataLayerEvent } from '@/lib/gtm/types';
import { getFirebaseAnalytics, getFirebaseAnalyticsConfig, initializeFirebaseAnalytics } from '@/src/lib/firebase';
import {
  mapGtmEventToFirebaseDispatches,
  type FirebaseAnalyticsDispatch,
} from '@/src/services/analytics-gtm-mapper';
import type { FirebaseEcommerceEventParams } from '@/src/types/analytics';

let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeFirebaseAnalytics();
  }
  await initPromise;
}

async function dispatchToFirebase(dispatch: FirebaseAnalyticsDispatch): Promise<void> {
  const analytics = getFirebaseAnalytics();
  if (!analytics) return;

  if (dispatch.type === 'screen_view') {
    await analytics.logScreenView({
      screen_name: dispatch.screenName,
      screen_class: dispatch.screenClass ?? dispatch.screenName,
    });
    return;
  }

  if (dispatch.type === 'custom') {
    await analytics.logEvent(dispatch.name, dispatch.params ?? {});
    return;
  }

  const params = dispatch.params as FirebaseEcommerceEventParams;

  switch (dispatch.method) {
    case 'logViewItem':
      await analytics.logViewItem(params);
      break;
    case 'logAddToCart':
      await analytics.logAddToCart(params);
      break;
    case 'logRemoveFromCart':
      await analytics.logRemoveFromCart(params);
      break;
    case 'logViewCart':
      await analytics.logViewCart(params);
      break;
    case 'logBeginCheckout':
      await analytics.logBeginCheckout(params);
      break;
    case 'logPurchase':
      await analytics.logPurchase(params);
      break;
    case 'logSearch':
      await analytics.logSearch({
        search_term: params.search_term ?? '',
        ...params,
      });
      break;
    case 'logLogin':
      await analytics.logLogin({ method: params.method ?? 'email' });
      break;
    case 'logSignUp':
      await analytics.logSignUp({ method: params.method ?? 'email' });
      break;
    case 'logAddToWishlist':
      await analytics.logAddToWishlist(params);
      break;
    case 'logViewItemList':
      await analytics.logViewItemList(params);
      break;
    default:
      break;
  }
}

/**
 * Forwards a GTM data layer payload to Firebase Analytics.
 * Safe to call on every `pushToDataLayer` — no-ops when disabled or native module is missing.
 */
export function trackDataLayerEventForFirebase(event: GtmDataLayerEvent): void {
  if (!getFirebaseAnalyticsConfig().enabled) return;

  void (async () => {
    try {
      await ensureInitialized();
      const analytics = getFirebaseAnalytics();
      if (!analytics) return;

      const dispatches = mapGtmEventToFirebaseDispatches(event);
      for (const dispatch of dispatches) {
        await dispatchToFirebase(dispatch);
      }

    } catch {
      // Firebase analytics failures are non-fatal.
    }
  })();
}

// --- Example ecommerce events (also available via `@/lib/gtm` helpers) ---

/** Example: product detail view — prefer `trackViewItem` from `@/lib/gtm`. */
export function exampleTrackViewItem() {
  return {
    event: 'view_item' as const,
    ecommerce: {
      currency: 'GBP',
      value: 89,
      items: [
        {
          item_id: 'gid://shopify/ProductVariant/123',
          item_name: 'Linen Shirt',
          item_brand: 'Koko Bay',
          item_category: 'Tops',
          price: 89,
          quantity: 1,
        },
      ],
    },
  } satisfies GtmDataLayerEvent;
}

/** Example: add to bag — prefer `trackAddToCart` from `@/lib/gtm`. */
export function exampleTrackAddToCart() {
  return {
    event: 'add_to_cart' as const,
    ecommerce: {
      currency: 'GBP',
      value: 89,
      items: [
        {
          item_id: 'gid://shopify/ProductVariant/123',
          item_name: 'Linen Shirt',
          price: 89,
          quantity: 1,
        },
      ],
    },
  } satisfies GtmDataLayerEvent;
}

/** Example: completed order — prefer `trackPurchase` from `@/lib/gtm`. */
export function exampleTrackPurchase() {
  return {
    event: 'purchase' as const,
    ecommerce: {
      transaction_id: 'ORDER-1001',
      currency: 'GBP',
      value: 178,
      items: [
        {
          item_id: 'gid://shopify/ProductVariant/123',
          item_name: 'Linen Shirt',
          price: 89,
          quantity: 2,
        },
      ],
    },
  } satisfies GtmDataLayerEvent;
}
