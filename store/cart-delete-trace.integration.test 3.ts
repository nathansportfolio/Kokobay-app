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

let cartEngine: CartEngineModule['cartEngine'];
let flushCartSync: CartStoreModule['flushCartSync'];
let resetCartStateForTests: CartStoreModule['resetCartStateForTests'];
let useCartStore: CartStoreModule['useCartStore'];

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('cart delete trace reproduction', () => {
  before(async () => {
    const cartEngineMod = await import('@/src/core/cart/cart-engine');
    const cartStoreMod = await import('@/store/cart');

    cartEngine = cartEngineMod.cartEngine;
    flushCartSync = cartStoreMod.flushCartSync;
    resetCartStateForTests = cartStoreMod.resetCartStateForTests;
    useCartStore = cartStoreMod.useCartStore;
  });

  beforeEach(async () => {
    mocks.secureStore.clear();
    mocks.cartServer.reset();
    await resetCartStateForTests({ clearPersistedCart: true });
    await cartEngine.hydrate();
  });

  it('add two variants, delete one, wait 3s — emit CART_DELETE_TRACE', async () => {
    const traceLines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      const line = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
      if (line.includes('[CART_DELETE_TRACE]')) {
        traceLines.push(line);
      }
      originalLog(...args);
    };

    try {
      console.log('[REPRO] step=add_variant_a');
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      console.log('[REPRO] step=add_variant_b');
      cartEngine.addItem(addLineInput(TEST_VARIANT_B, TEST_HANDLE_B));
      console.log('[REPRO] step=flush_after_adds');
      await flushCartSync();

      const beforeDelete = useCartStore.getState().lines.map((line) => ({
        variantId: line.variantId,
        shopifyLineId: line.shopifyLineId ?? null,
      }));
      console.log('[REPRO] local_lines_before_delete', JSON.stringify(beforeDelete, null, 2));

      console.log('[REPRO] step=remove_variant_a');
      cartEngine.removeItem(TEST_VARIANT_A);

      const afterLocalDelete = useCartStore.getState().lines.map((line) => line.variantId);
      console.log('[REPRO] local_lines_after_delete', JSON.stringify(afterLocalDelete, null, 2));

      console.log('[REPRO] step=wait_3000ms');
      await sleep(3000);

      const afterWait = useCartStore.getState().lines.map((line) => ({
        variantId: line.variantId,
        shopifyLineId: line.shopifyLineId ?? null,
      }));
      console.log('[REPRO] local_lines_after_wait', JSON.stringify(afterWait, null, 2));
      console.log('[REPRO] CART_DELETE_TRACE_COUNT', traceLines.length);

      for (const trace of traceLines) {
        console.log(trace);
      }

      assert.equal(afterWait.length, 1);
      assert.equal(afterWait[0]?.variantId, TEST_VARIANT_B);
      assert.ok(traceLines.length >= 1, 'expected at least one CART_DELETE_TRACE log');
    } finally {
      console.log = originalLog;
    }
  });
});
