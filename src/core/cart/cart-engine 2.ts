/**
 * Cart Engine — single entry point for all bag mutations and sync.
 *
 * UI → cartEngine → store/cart (internal) → API
 *
 * Do not call `useCartStore.getState().addToCart` (etc.) from screens or providers.
 */
import { applyKokobayCartDiscountCode } from '@/services/kokobay-web/cart';
import { getCartCustomerEmail } from '@/services/kokobay-web/cart-customer';
import { maybeAutoApplyFirstAppOrderDiscountAsync } from '@/services/cart/auto-first-app-order-discount';
import { loadCartGuestId } from '@/store/cart-persist';
import {
  clearRemoteCartInBackground,
  deferCartMergeUntilHydrate,
  ensureCartSyncedForCheckout,
  flushCartSync,
  mergeGuestCartOnLogin,
  recoverCartApplyServerSnapshot,
  recoverCartClearLocalStorage,
  refreshStoreCheckoutUrl,
  resetCartForSignOut,
  useCartStore,
  applyValidatedRemoteSnapshot,
  type AddToCartInput,
  type CartRecoveryResult,
} from '@/store/cart';
import type { ShopifyCartSnapshot } from '@/services/shopify/cart';
import type { CartLine } from '@/types/cart';

async function applyDiscountSnapshot(
  result: Awaited<ReturnType<typeof applyKokobayCartDiscountCode>>,
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  if (!result) {
    return { ok: false, error: 'Could not apply discount code.' };
  }
  if (result.syncError) {
    return {
      ok: false,
      error: result.syncError.message,
      code: result.syncError.code,
    };
  }
  if (result.snapshot) {
    applyValidatedRemoteSnapshot(result.snapshot, { source: 'cart_engine_apply_discount' });
    if (result.guestId) {
      const { persistCartGuestId } = await import('@/store/cart-persist');
      await persistCartGuestId(result.guestId);
    }
    return { ok: true };
  }
  return { ok: false, error: 'Could not apply discount code.' };
}

export const cartEngine = {
  /** Load persisted lines + schedule background sync. */
  hydrate(): Promise<void> {
    return useCartStore.getState().hydrate();
  },

  addItem(input: AddToCartInput): void {
    useCartStore.getState().addToCart(input);
  },

  removeItem(variantId: string): void {
    useCartStore.getState().removeItem(variantId);
  },

  updateQty(variantId: string, qty: number): void {
    useCartStore.getState().updateQuantity(variantId, qty);
  },

  nudgeQty(variantId: string, delta: number): void {
    useCartStore.getState().nudgeCartLineQuantity(variantId, delta);
  },

  clear(): void {
    useCartStore.getState().clear();
  },

  /** POST /api/cart/discount-code then apply server snapshot. */
  async applyDiscountCode(code: string, customerEmail?: string) {
    const guestId = await loadCartGuestId();
    const lines = useCartStore.getState().lines;
    const result = await applyKokobayCartDiscountCode(
      guestId,
      code,
      lines,
      customerEmail ?? getCartCustomerEmail(),
    );
    return applyDiscountSnapshot(result);
  },

  /** First-app-order auto discount (logged-in). */
  async applyAutoDiscount(customerEmail?: string): Promise<void> {
    await maybeAutoApplyFirstAppOrderDiscountAsync(customerEmail);
  },

  /** Debounced background sync. */
  sync(customerEmail?: string): void {
    void flushCartSync({ customerEmail, force: false });
  },

  /** Flush pending mutations — use at checkout. Returns true when cart matches Shopify. */
  async syncForCheckout(customerEmail?: string): Promise<boolean> {
    return ensureCartSyncedForCheckout(customerEmail);
  },

  async checkout(customerEmail?: string): Promise<boolean> {
    return ensureCartSyncedForCheckout(customerEmail);
  },

  deferMergeOnLogin(customerEmail: string): void {
    deferCartMergeUntilHydrate(customerEmail);
  },

  async mergeOnLogin(customerEmail: string): Promise<void> {
    await mergeGuestCartOnLogin(customerEmail);
  },

  resetOnSignOut(): void {
    resetCartForSignOut();
  },

  clearRemote(): Promise<void> {
    return clearRemoteCartInBackground();
  },

  refreshCheckoutUrl(customerEmail?: string): Promise<string | null> {
    return refreshStoreCheckoutUrl(customerEmail);
  },

  applyServerSnapshot(snapshot: ShopifyCartSnapshot, reconciledLines?: CartLine[]): void {
    applyValidatedRemoteSnapshot(snapshot, {
      reconciledLines,
      source: 'cart_engine_apply_server_snapshot',
    });
  },

  recoverClearLocal(): Promise<CartRecoveryResult> {
    return recoverCartClearLocalStorage();
  },

  recoverApplySnapshot(customerEmail?: string): Promise<CartRecoveryResult> {
    return recoverCartApplyServerSnapshot(customerEmail);
  },
} as const;

export type CartEngine = typeof cartEngine;
