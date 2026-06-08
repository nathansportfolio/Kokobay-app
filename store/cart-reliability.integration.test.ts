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
type GatewayModule = typeof import('@/store/cart-snapshot-gateway');
type WatchdogModule = typeof import('@/store/cart-sync-watchdog');

let cartEngine: CartEngineModule['cartEngine'];
let flushCartSync: CartStoreModule['flushCartSync'];
let ensureCartSyncedForCheckout: CartStoreModule['ensureCartSyncedForCheckout'];
let isCartConfirmedSyncedForCheckout: CartStoreModule['isCartConfirmedSyncedForCheckout'];
let resetCartStateForTests: CartStoreModule['resetCartStateForTests'];
let useCartStore: CartStoreModule['useCartStore'];
let applyValidatedRemoteSnapshot: GatewayModule['applyValidatedRemoteSnapshot'];
let evaluateCartSyncWatchdogForTests: WatchdogModule['evaluateCartSyncWatchdogForTests'];
let noteCartSyncPendingActive: WatchdogModule['noteCartSyncPendingActive'];
let getCartSyncWatchdogPendingSinceForTests: WatchdogModule['getCartSyncWatchdogPendingSinceForTests'];

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

function malformedSnapshot() {
  return {
    cartId: 'cart-bad',
    checkoutUrl: 'https://checkout.test/c/bad',
    lines: [] as never[],
    subtotal: { amount: '89.00', currencyCode: 'GBP' },
    total: { amount: '89.00', currencyCode: 'GBP' },
  };
}

describe('cart reliability', () => {
  before(async () => {
    const cartEngineMod = await import('@/src/core/cart/cart-engine');
    const cartStoreMod = await import('@/store/cart');
    const gatewayMod = await import('@/store/cart-snapshot-gateway');
    const watchdogMod = await import('@/store/cart-sync-watchdog');

    cartEngine = cartEngineMod.cartEngine;
    flushCartSync = cartStoreMod.flushCartSync;
    ensureCartSyncedForCheckout = cartStoreMod.ensureCartSyncedForCheckout;
    isCartConfirmedSyncedForCheckout = cartStoreMod.isCartConfirmedSyncedForCheckout;
    resetCartStateForTests = cartStoreMod.resetCartStateForTests;
    useCartStore = cartStoreMod.useCartStore;
    applyValidatedRemoteSnapshot = gatewayMod.applyValidatedRemoteSnapshot;
    evaluateCartSyncWatchdogForTests = watchdogMod.evaluateCartSyncWatchdogForTests;
    noteCartSyncPendingActive = watchdogMod.noteCartSyncPendingActive;
    getCartSyncWatchdogPendingSinceForTests = watchdogMod.getCartSyncWatchdogPendingSinceForTests;
  });

  beforeEach(async () => {
    mocks.secureStore.clear();
    mocks.cartServer.reset();
    await resetCartStateForTests({ clearPersistedCart: true });
    await cartEngine.hydrate();
  });

  it('rejects malformed snapshots without mutating local lines', async () => {
    cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
    await flushCartSync();
    const before = useCartStore.getState().lines.length;

    const result = applyValidatedRemoteSnapshot(malformedSnapshot(), {
      source: 'test_malformed_snapshot',
    });

    assert.equal(result, 'rejected');
    assert.equal(useCartStore.getState().lines.length, before);
  });

  it('rejects stale snapshots when version fields are present', async () => {
    cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
    await flushCartSync();

    const newer = {
      ...malformedSnapshot(),
      lines: useCartStore.getState().lines,
      subtotal: { amount: '89.00', currencyCode: 'GBP' },
      total: { amount: '89.00', currencyCode: 'GBP' },
      updatedAt: '2026-06-08T12:00:00.000Z',
    };
    applyValidatedRemoteSnapshot(newer as never, { source: 'test_newer_snapshot' });

    const older = {
      ...newer,
      lines: [
        ...useCartStore.getState().lines,
        {
          handle: TEST_HANDLE_B,
          variantId: TEST_VARIANT_B,
          qty: 1,
          unitPrice: { amount: '89.00', currencyCode: 'GBP' },
        },
      ],
      updatedAt: '2026-06-08T10:00:00.000Z',
    };

    const result = applyValidatedRemoteSnapshot(older as never, {
      source: 'test_stale_snapshot',
    });
    assert.equal(result, 'stale_rejected');
  });

  it('checkout gate confirms synced cart before returning true', async () => {
    cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
    cartEngine.addItem(addLineInput(TEST_VARIANT_B, TEST_HANDLE_B));
    await flushCartSync();

    const synced = await ensureCartSyncedForCheckout();
    assert.equal(synced, true);
    assert.equal(isCartConfirmedSyncedForCheckout(), true);
  });

  it('watchdog triggers authoritative recovery after pending sync timeout', async () => {
    cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
    useCartStore.setState({ pendingCartSync: true });
    noteCartSyncPendingActive();

    const since = getCartSyncWatchdogPendingSinceForTests();
    assert.ok(since != null);
    if (since != null) {
      const originalNow = Date.now;
      Date.now = () => since + 11_000;
      try {
        evaluateCartSyncWatchdogForTests();
      } finally {
        Date.now = originalNow;
      }
    }

    await flushCartSync();
    assert.equal(isCartConfirmedSyncedForCheckout(), true);
  });
});
