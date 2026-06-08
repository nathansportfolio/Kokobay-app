import { create } from 'zustand';

import { registerAutoDiscountCartAccess } from '@/services/cart/auto-discount-cart-access';
import type { CartAppliedDiscount } from '@/utils/cart-cost-breakdown';
import type { CartDiscountCode } from '@/types/cart';
import type { Money } from '@/types/shopify';

import { createCartStoreActions, createRemoteSnapshotCommit } from './cart-state';
import {
  bindCartHealthReaders,
  bindCartSnapshotGateway,
  applyValidatedRemoteSnapshot,
  resetCartSnapshotGatewayForTests,
} from './cart-snapshot-gateway';
import {
  bindCartSyncWatchdog,
  resetCartSyncWatchdogForTests,
} from './cart-sync-watchdog';
import {
  runCartPersistenceHydrate,
  wireDebouncedCartLinePersistence,
} from './cart-persistence';
import {
  bindCartPricingRevision,
  selectCartPricingForDisplay,
  selectIsCartCheckoutPricingPending,
  selectIsLineQuantityPricePending,
  type CartPricingForDisplay,
  type ReservedCartPricing,
} from './cart-pricing';
import {
  bindCartSyncStore,
  createSyncWithShopify,
  finishCartHydrationPostSync,
  getCartActionRuntime,
  getCartRevisionSnapshot,
} from './cart-sync';
import type { AddToCartInput, CartRecoveryResult, CartState } from './cart-types';

export type {
  AddToCartInput,
  CartLine,
  CartDiscountCode,
  CartRecoveryResult,
  CartState,
  ReservedCartPricing,
} from './cart-types';
export type { CartPricingForDisplay } from './cart-pricing';
export {
  clearRemoteCartInBackground,
  deferCartMergeUntilHydrate,
  ensureCartSyncedForCheckout,
  flushCartSync,
  getCartNetworkSyncMetrics,
  getCartRevisionSnapshot,
  isCartConfirmedSyncedForCheckout,
  isCartSettledForCheckout,
  mergeGuestCartOnLogin,
  recoverCartApplyServerSnapshot,
  recoverCartClearLocalStorage,
  refreshStoreCheckoutUrl,
  resetCartForSignOut,
  resetCartStateForTests,
} from './cart-sync';
export { applyValidatedRemoteSnapshot } from './cart-snapshot-gateway';
export { validateCartSnapshot } from './cart-snapshot-validate';
export {
  selectCartPricingForDisplay,
  selectIsCartCheckoutPricingPending,
  selectIsLineQuantityPricePending,
} from './cart-pricing';

const INITIAL_CART_STORE_STATE = {
  lines: [] as CartState['lines'],
  shopifyCartId: null as string | null,
  checkoutUrl: null as string | null,
  storeCheckoutUrl: null as string | null,
  shopifySubtotal: null as Money | null,
  shopifyTotal: null as Money | null,
  shopifyTotalTax: null as Money | null,
  shopifyDiscountCodes: [] as CartDiscountCode[],
  shopifyCartDiscountAmount: null as Money | null,
  shopifyLineMerchandiseSubtotal: null as Money | null,
  shopifyLineMerchandiseTotal: null as Money | null,
  reservedDiscountPricing: null as ReservedCartPricing | null,
  displayAppliedDiscounts: [] as CartAppliedDiscount[],
  isSyncingShopify: false,
  pendingCartSync: false,
  quantitySyncPendingByVariantId: {} as Record<string, true>,
  hasHydrated: false,
};

export const useCartStore = create<CartState>((set, get) => {
  const syncRuntime = getCartActionRuntime();

  const storeActions = createCartStoreActions(set, get, syncRuntime);

  bindCartSnapshotGateway({
    getRevisionSnapshot: getCartRevisionSnapshot,
    commitRemoteSnapshot: createRemoteSnapshotCommit(set, get, {
      getRevision: syncRuntime.getRevision,
      getRevisionSnapshot: syncRuntime.getRevisionSnapshot,
      mergeSyncedCartLines: syncRuntime.mergeSyncedCartLines,
      clearAllQuantitySyncPending: syncRuntime.clearAllQuantitySyncPending,
    }),
    scheduleSnapshotRecovery: () => syncRuntime.scheduleSnapshotRecovery(),
    scheduleDivergenceHeal: () => {
      void syncRuntime.flushAuthoritativeCartSync();
    },
    readLocalLines: () => get().lines,
    readLocalSubtotal: () => get().shopifySubtotal,
  });

  bindCartHealthReaders({
    readPendingCartSync: () => get().pendingCartSync,
    readIsSyncingShopify: () => get().isSyncingShopify,
  });

  bindCartSyncWatchdog(
    {
      readPendingCartSync: () => get().pendingCartSync,
      readIsSyncingShopify: () => get().isSyncingShopify,
    },
    () => {
      void syncRuntime.flushAuthoritativeCartSync();
    },
  );

  return {
    ...INITIAL_CART_STORE_STATE,

    hydrate: () =>
      runCartPersistenceHydrate(get, set, {
        getRevision: syncRuntime.getRevision,
        getLastSyncedRevision: () => getCartRevisionSnapshot().lastSyncedRevision,
        bumpRevision: syncRuntime.bumpRevision,
        scheduleSync: syncRuntime.scheduleSync,
        finishHydrationPostSync: finishCartHydrationPostSync,
      }),

    syncWithShopify: createSyncWithShopify(set, get),

    ...storeActions,
  };
});

bindCartSyncStore(() => useCartStore);
bindCartPricingRevision(getCartRevisionSnapshot);
wireDebouncedCartLinePersistence(useCartStore, () => getCartRevisionSnapshot().cartRevision);
registerAutoDiscountCartAccess({
  readState: () => {
    const state = useCartStore.getState();
    return { lines: state.lines, shopifyDiscountCodes: state.shopifyDiscountCodes };
  },
  applySnapshot: (snapshot) => {
    applyValidatedRemoteSnapshot(snapshot, { source: 'auto_first_order_discount' });
  },
});

/** @internal — tests reset via resetCartStateForTests */
export { INITIAL_CART_STORE_STATE };
