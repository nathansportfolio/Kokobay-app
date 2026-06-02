import { cartPerfLog } from '@/lib/cart-perf-log';
import {
  addCartLineFast,
  syncLocalCartToKokobayWeb,
  updateCartQuantityFast,
} from '@/services/kokobay-web/cart';
import { syncLocalCartToShopify, type ShopifyCartSnapshot } from '@/services/shopify/cart';
import type { CartLine } from '@/types/cart';

import { isRemoteCartConfigured, usesKokobayCartProxy } from './remote-cart';

export type { ShopifyCartSnapshot as RemoteCartSnapshot };

export type CartSyncError = {
  code: string;
  message: string;
};

export type RemoteCartSyncResult = {
  snapshot: ShopifyCartSnapshot | null;
  shopifyCartId: string | null;
  guestId: string | null;
  syncError?: CartSyncError | null;
};

/**
 * Push local bag to Shopify — via Koko Bay web proxy when catalog uses Mongo,
 * otherwise direct Storefront GraphQL.
 */
export async function syncLocalCartToRemote(
  shopifyCartId: string | null,
  guestId: string | null,
  localLines: CartLine[],
  customerEmail?: string,
  fallbackCheckoutUrl?: string | null,
): Promise<RemoteCartSyncResult | null> {
  if (!isRemoteCartConfigured()) return null;

  if (!localLines.length) {
    if (usesKokobayCartProxy()) {
      const cleared = await syncLocalCartToKokobayWeb(guestId, [], customerEmail);
      return {
        snapshot: null,
        shopifyCartId: null,
        guestId: cleared?.guestId ?? guestId,
      };
    }
    return { snapshot: null, shopifyCartId: null, guestId: null };
  }

  if (usesKokobayCartProxy()) {
    const remoteStart = performance.now();
    const result = await syncLocalCartToKokobayWeb(
      guestId,
      localLines,
      customerEmail,
      fallbackCheckoutUrl,
    );
    cartPerfLog(`syncLocalCartToRemote (kokobay) took ${Math.round(performance.now() - remoteStart)}ms`);
    if (!result) return null;
    return {
      snapshot: result.snapshot,
      shopifyCartId: result.snapshot?.cartId ?? shopifyCartId,
      guestId: result.guestId,
      syncError: result.syncError ?? null,
    };
  }

  const snapshot = await syncLocalCartToShopify(shopifyCartId, localLines);
  return {
    snapshot,
    shopifyCartId: snapshot?.cartId ?? shopifyCartId,
    guestId: null,
  };
}

/**
 * PATCH line quantity via Koko Bay proxy — skips GET /api/cart and full reconcile.
 */
/** POST a new line via Koko Bay proxy — skips GET /api/cart and full reconcile. */
export async function postCartAddLineFast(
  guestId: string | null,
  variantId: string,
  quantity: number,
  localLines: CartLine[],
  customerEmail?: string,
  fallbackCheckoutUrl?: string | null,
): Promise<RemoteCartSyncResult | null> {
  if (!isRemoteCartConfigured() || !usesKokobayCartProxy()) return null;

  const result = await addCartLineFast(
    guestId,
    variantId,
    quantity,
    localLines,
    customerEmail,
    fallbackCheckoutUrl,
  );
  if (!result) return null;
  return {
    snapshot: result.snapshot,
    shopifyCartId: result.snapshot?.cartId ?? null,
    guestId: result.guestId,
    syncError: result.syncError ?? null,
  };
}

export async function patchCartQuantityFast(
  guestId: string | null,
  lineId: string,
  quantity: number,
  localLines: CartLine[],
  customerEmail?: string,
  fallbackCheckoutUrl?: string | null,
): Promise<RemoteCartSyncResult | null> {
  if (!isRemoteCartConfigured() || !usesKokobayCartProxy()) return null;

  const result = await updateCartQuantityFast(
    guestId,
    lineId,
    quantity,
    localLines,
    customerEmail,
    fallbackCheckoutUrl,
  );
  if (!result) return null;
  return {
    snapshot: result.snapshot,
    shopifyCartId: result.snapshot?.cartId ?? null,
    guestId: result.guestId,
    syncError: result.syncError ?? null,
  };
}
