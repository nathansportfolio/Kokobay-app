/**
 * Cart Engine — single entry point for all bag mutations and sync.
 *
 * UI → cartEngine → store/cart (internal) → API
 *
 * Do not call `useCartStore.getState().addToCart` (etc.) from screens or providers.
 */
import { logCartTrace, logCartTraceWithStore } from '@/lib/cart-trace-log';
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
    logCartTrace('engine_hydrate_start');
    return useCartStore.getState().hydrate().then(() => {
      logCartTraceWithStore('engine_hydrate_complete');
    });
  },

  addItem(input: AddToCartInput): void {
    logCartTraceWithStore('engine_add_item', {
      variantId: input.variantId,
      quantity: input.qty,
      handle: input.handle,
    });
    useCartStore.getState().addToCart(input);
  },

  removeItem(variantId: string): void {
    logCartTraceWithStore('engine_remove_item', { variantId });
    useCartStore.getState().removeItem(variantId);
  },

  updateQty(variantId: string, qty: number): void {
    logCartTraceWithStore('engine_update_qty', { variantId, quantity: qty });
    useCartStore.getState().updateQuantity(variantId, qty);
  },

  nudgeQty(variantId: string, delta: number): void {
    logCartTraceWithStore('engine_nudge_qty', { variantId, quantity: delta });
    useCartStore.getState().nudgeCartLineQuantity(variantId, delta);
  },

  clear(): void {
    logCartTraceWithStore('engine_clear');
    useCartStore.getState().clear();
  },

  /** POST /api/cart/discount-code then apply server snapshot. */
  async applyDiscountCode(code: string, customerEmail?: string) {
    logCartTraceWithStore('engine_apply_discount_start', { code });
    const guestId = await loadCartGuestId();
    const lines = useCartStore.getState().lines;
    const result = await applyKokobayCartDiscountCode(
      guestId,
      code,
      lines,
      customerEmail ?? getCartCustomerEmail(),
    );
    const applied = await applyDiscountSnapshot(result);
    logCartTraceWithStore('engine_apply_discount_complete', {
      ok: applied.ok,
      guestId,
      code,
    });
    return applied;
  },

  /** First-app-order auto discount (logged-in). */
  async applyAutoDiscount(customerEmail?: string): Promise<void> {
    logCartTraceWithStore('engine_apply_auto_discount_start', { customerEmail: customerEmail ?? null });
    await maybeAutoApplyFirstAppOrderDiscountAsync(customerEmail);
    logCartTraceWithStore('engine_apply_auto_discount_complete');
  },

  /** Debounced background sync. */
  sync(customerEmail?: string): void {
    logCartTraceWithStore('engine_sync', { customerEmail: customerEmail ?? null });
    void flushCartSync({ customerEmail, force: false });
  },

  /** Flush pending mutations — use at checkout. Returns true when cart matches Shopify. */
  async syncForCheckout(customerEmail?: string): Promise<boolean> {
    logCartTraceWithStore('engine_sync_for_checkout_start', { customerEmail: customerEmail ?? null });
    const ok = await ensureCartSyncedForCheckout(customerEmail);
    logCartTraceWithStore('engine_sync_for_checkout_complete', { ok, customerEmail: customerEmail ?? null });
    return ok;
  },

  async checkout(customerEmail?: string): Promise<boolean> {
    logCartTraceWithStore('engine_checkout_start', { customerEmail: customerEmail ?? null });
    const ok = await ensureCartSyncedForCheckout(customerEmail);
    logCartTraceWithStore('engine_checkout_complete', { ok, customerEmail: customerEmail ?? null });
    return ok;
  },

  deferMergeOnLogin(customerEmail: string): void {
    logCartTrace('engine_defer_merge_on_login', { customerEmail });
    deferCartMergeUntilHydrate(customerEmail);
  },

  async mergeOnLogin(customerEmail: string): Promise<void> {
    logCartTraceWithStore('engine_merge_on_login_start', { customerEmail });
    await mergeGuestCartOnLogin(customerEmail);
    logCartTraceWithStore('engine_merge_on_login_complete', { customerEmail });
  },

  resetOnSignOut(): void {
    logCartTrace('engine_reset_on_sign_out');
    resetCartForSignOut();
  },

  clearRemote(): Promise<void> {
    logCartTraceWithStore('engine_clear_remote_start');
    return clearRemoteCartInBackground().then(() => {
      logCartTraceWithStore('engine_clear_remote_complete');
    });
  },

  refreshCheckoutUrl(customerEmail?: string): Promise<string | null> {
    logCartTraceWithStore('engine_refresh_checkout_url_start', { customerEmail: customerEmail ?? null });
    return refreshStoreCheckoutUrl(customerEmail).then((url) => {
      logCartTraceWithStore('engine_refresh_checkout_url_complete', {
        customerEmail: customerEmail ?? null,
        checkoutUrl: url,
      });
      return url;
    });
  },

  applyServerSnapshot(snapshot: ShopifyCartSnapshot, reconciledLines?: CartLine[]): void {
    logCartTrace('engine_apply_server_snapshot', {
      cartId: snapshot.cartId,
      lineCount: snapshot.lines.length,
    });
    applyValidatedRemoteSnapshot(snapshot, {
      reconciledLines,
      source: 'cart_engine_apply_server_snapshot',
    });
  },

  recoverClearLocal(): Promise<CartRecoveryResult> {
    logCartTrace('engine_recover_clear_local_start');
    return recoverCartClearLocalStorage().then((result) => {
      logCartTrace('engine_recover_clear_local_complete', { ok: result.ok });
      return result;
    });
  },

  recoverApplySnapshot(customerEmail?: string): Promise<CartRecoveryResult> {
    logCartTraceWithStore('engine_recover_apply_snapshot_start', { customerEmail: customerEmail ?? null });
    return recoverCartApplyServerSnapshot(customerEmail).then((result) => {
      logCartTraceWithStore('engine_recover_apply_snapshot_complete', {
        ok: result.ok,
        customerEmail: customerEmail ?? null,
      });
      return result;
    });
  },
} as const;

export type CartEngine = typeof cartEngine;
