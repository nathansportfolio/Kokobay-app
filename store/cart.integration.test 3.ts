import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';

import {
  cartIntegrationSecureStore,
  cartIntegrationServer,
} from '@/tests/cart/cart-test-runtime';
import {
  TEST_HANDLE_A,
  TEST_HANDLE_B,
  TEST_VARIANT_A,
  TEST_VARIANT_B,
} from '@/tests/cart/mock-kokobay-cart-server';

const mocks = {
  secureStore: cartIntegrationSecureStore,
  cartServer: cartIntegrationServer,
};

type CartEngineModule = typeof import('@/src/core/cart/cart-engine');
type CartStoreModule = typeof import('@/store/cart');
type AuthRefreshModule = typeof import('@/src/core/auth/refresh-customer-session');
type CartPersistModule = typeof import('@/store/cart-persist');

let cartEngine: CartEngineModule['cartEngine'];
let refreshCustomerSession: AuthRefreshModule['refreshCustomerSession'];
let flushCartSync: CartStoreModule['flushCartSync'];
let mergeGuestCartOnLogin: CartStoreModule['mergeGuestCartOnLogin'];
let refreshStoreCheckoutUrl: CartStoreModule['refreshStoreCheckoutUrl'];
let resetCartForSignOut: CartStoreModule['resetCartForSignOut'];
let resetCartStateForTests: CartStoreModule['resetCartStateForTests'];
let useCartStore: CartStoreModule['useCartStore'];
let loadPersistedCart: CartPersistModule['loadPersistedCart'];
let loadCartGuestId: CartPersistModule['loadCartGuestId'];

function addLineInput(variantId: string, handle: string, qty = 1) {
  return {
    handle,
    variantId,
    qty,
    title: handle,
    unitPrice: { amount: '89.00', currencyCode: 'GBP' },
    imageUrl: 'https://cdn.example.test/image.jpg',
  };
}

async function waitForPersist(ms = 220): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('cart integration', () => {
  before(async () => {
    const cartEngineMod = await import('@/src/core/cart/cart-engine');
    const cartStoreMod = await import('@/store/cart');
    const authMod = await import('@/src/core/auth/refresh-customer-session');
    const persistMod = await import('@/store/cart-persist');

    cartEngine = cartEngineMod.cartEngine;
    refreshCustomerSession = authMod.refreshCustomerSession;
    flushCartSync = cartStoreMod.flushCartSync;
    mergeGuestCartOnLogin = cartStoreMod.mergeGuestCartOnLogin;
    refreshStoreCheckoutUrl = cartStoreMod.refreshStoreCheckoutUrl;
    resetCartForSignOut = cartStoreMod.resetCartForSignOut;
    resetCartStateForTests = cartStoreMod.resetCartStateForTests;
    useCartStore = cartStoreMod.useCartStore;
    loadPersistedCart = persistMod.loadPersistedCart;
    loadCartGuestId = persistMod.loadCartGuestId;
  });

  beforeEach(async () => {
    mocks.secureStore.clear();
    mocks.cartServer.reset();
    await resetCartStateForTests({ clearPersistedCart: true });
    await cartEngine.hydrate();
  });

  describe('guest cart', () => {
    it('adds an item and syncs to the mock API', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      assert.equal(useCartStore.getState().lines.length, 1);

      await flushCartSync();
      assert.ok(useCartStore.getState().lines[0]?.shopifyLineId);
      assert.ok(useCartStore.getState().storeCheckoutUrl?.includes('kokobay.co.uk'));
    });

    it('updates quantity', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A, 1));
      await flushCartSync();

      cartEngine.updateQty(TEST_VARIANT_A, 3);
      await flushCartSync();

      assert.equal(useCartStore.getState().lines[0]?.qty, 3);
    });

    it('removes an item', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      cartEngine.addItem(addLineInput(TEST_VARIANT_B, TEST_HANDLE_B));
      await flushCartSync();

      cartEngine.removeItem(TEST_VARIANT_A);
      await flushCartSync();

      assert.equal(useCartStore.getState().lines.length, 1);
      assert.equal(useCartStore.getState().lines[0]?.variantId, TEST_VARIANT_B);
    });

    it('clears the cart locally and remotely', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      await flushCartSync();

      cartEngine.clear();
      await flushCartSync();

      assert.equal(useCartStore.getState().lines.length, 0);
      assert.equal(useCartStore.getState().shopifyCartId, null);
    });
  });

  describe('guest -> login merge', () => {
    it('keeps guest lines after login merge sync', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A, 2));
      await flushCartSync();

      await mergeGuestCartOnLogin('shopper@example.com');
      await flushCartSync();

      const { lines } = useCartStore.getState();
      assert.equal(lines.length, 1);
      assert.equal(lines[0]?.qty, 2);
      assert.ok(lines[0]?.shopifyLineId);
    });
  });

  describe('discount codes', () => {
    it('applies a valid discount code', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      await flushCartSync();

      const result = await cartEngine.applyDiscountCode('SAVE10');
      assert.equal(result.ok, true);
      assert.ok(useCartStore.getState().shopifyDiscountCodes.some((entry) => entry.code === 'SAVE10'));
    });

    it('removes a discount code via server sync', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      await flushCartSync();

      const applied = await cartEngine.applyDiscountCode('SAVE10');
      assert.equal(applied.ok, true);

      const guestId = await loadCartGuestId();
      mocks.cartServer.clearDiscounts(guestId ?? 'guest-test-1');
      await flushCartSync();

      assert.equal(useCartStore.getState().shopifyDiscountCodes.length, 0);
    });

    it('returns an error for an invalid discount code', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      await flushCartSync();

      const result = await cartEngine.applyDiscountCode('INVALID');
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(result.error, /not valid|discount/i);
      }
    });
  });

  describe('persistence', () => {
    it('restores persisted lines after relaunch hydrate', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A, 2));
      await flushCartSync();
      await waitForPersist();

      await resetCartStateForTests();
      assert.equal(useCartStore.getState().hasHydrated, false);

      await cartEngine.hydrate();
      await waitForPersist();

      const persisted = await loadPersistedCart();
      assert.equal(persisted.length, 1);
      assert.equal(useCartStore.getState().lines.length, 1);
      assert.equal(useCartStore.getState().lines[0]?.qty, 2);
    });
  });

  describe('checkout URL generation', () => {
    it('refreshes and exposes a checkout URL after sync', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      await flushCartSync();

      const checkoutUrl = await refreshStoreCheckoutUrl();
      assert.ok(checkoutUrl);
      assert.match(checkoutUrl, /kokobay\.co\.uk\/cart\/c\//);
      assert.equal(useCartStore.getState().storeCheckoutUrl, checkoutUrl);
    });
  });

  describe('network failure during sync', () => {
    it('recovers on a subsequent flush after a failed sync', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      await flushCartSync();
      assert.ok(useCartStore.getState().lines[0]?.shopifyLineId);

      mocks.cartServer.queueNetworkFailures(1);
      cartEngine.updateQty(TEST_VARIANT_A, 2);

      await flushCartSync();
      assert.equal(useCartStore.getState().lines.length, 1);
      assert.equal(useCartStore.getState().lines[0]?.qty, 2);

      await flushCartSync();
      assert.equal(useCartStore.getState().lines[0]?.qty, 2);
      assert.ok(useCartStore.getState().lines[0]?.shopifyLineId);
    });
  });

  describe('session refresh during cart operations', () => {
    it('completes cart sync while session refresh runs', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      await flushCartSync();

      const [refreshResult] = await Promise.all([
        refreshCustomerSession('expired-session-token'),
        flushCartSync(),
      ]);

      assert.equal(refreshResult.status, 'ok');
      assert.ok(mocks.cartServer.refreshCallCount >= 1);
      assert.equal(useCartStore.getState().lines.length, 1);
      assert.ok(useCartStore.getState().lines[0]?.shopifyLineId);
    });
  });

  describe('sign out', () => {
    it('clears local cart immediately and remote cart in background', async () => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      await flushCartSync();
      assert.equal(useCartStore.getState().lines.length, 1);

      resetCartForSignOut();
      assert.equal(useCartStore.getState().lines.length, 0);

      await cartEngine.clearRemote();
      await flushCartSync();

      assert.equal(useCartStore.getState().lines.length, 0);
    });
  });
});
