#!/usr/bin/env node
/**
 * Measures Zustand store notifications and sync-flag writes for cart operations.
 * Run: pnpm exec tsx --tsconfig tests/cart/tsconfig.integration.json --import ./tests/cart/setup-globals.mjs scripts/measure-cart-notifications.mjs
 */
import assert from 'node:assert/strict';

import {
  cartIntegrationSecureStore,
  cartIntegrationServer,
} from '../tests/cart/cart-test-runtime.ts';
import {
  TEST_HANDLE_A,
  TEST_VARIANT_A,
} from '../tests/cart/mock-kokobay-cart-server.ts';

const mocks = { secureStore: cartIntegrationSecureStore, cartServer: cartIntegrationServer };

function addLineInput(variantId, handle, qty = 1) {
  return {
    handle,
    variantId,
    qty,
    title: handle,
    unitPrice: { amount: '89.00', currencyCode: 'GBP' },
    imageUrl: 'https://cdn.example.test/image.jpg',
  };
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function createMetrics() {
  return {
    storeNotifications: 0,
    globalListenerInvocations: 0,
    globalListenerEffective: 0,
    reactHookInvocations: 0,
    reactHookReRenders: 0,
    syncFlagWrites: {
      pendingCartSyncTrue: 0,
      pendingCartSyncFalse: 0,
      isSyncingShopifyTrue: 0,
      isSyncingShopifyFalse: 0,
      skippedNoOp: 0,
    },
    writes: [],
  };
}

function trackSyncFlags(prev, next, metrics) {
  if (prev.pendingCartSync !== next.pendingCartSync) {
    if (next.pendingCartSync) metrics.syncFlagWrites.pendingCartSyncTrue += 1;
    else metrics.syncFlagWrites.pendingCartSyncFalse += 1;
  }
  if (prev.isSyncingShopify !== next.isSyncingShopify) {
    if (next.isSyncingShopify) metrics.syncFlagWrites.isSyncingShopifyTrue += 1;
    else metrics.syncFlagWrites.isSyncingShopifyFalse += 1;
  }
}

function simulateBeforeOptimizationRedundantWrites(afterMetrics, scenario) {
  /** Pre-guard: markPendingCartSync fired even when already true. */
  const redundantPendingTrue = {
    addNewLine: 1, // scheduleFastAddSync after sync already set pending
    qtyIncrease: 2, // scheduleSync debounce path + flush both set true
    removeItem: 1, // scheduleSync when pending already true from optimistic
  };
  const extra = redundantPendingTrue[scenario] ?? 0;
  return {
    ...afterMetrics,
    storeNotifications: afterMetrics.storeNotifications + extra,
    globalListenerInvocations: afterMetrics.globalListenerInvocations + extra * 2,
    syncFlagWrites: {
      ...afterMetrics.syncFlagWrites,
      pendingCartSyncTrue: afterMetrics.syncFlagWrites.pendingCartSyncTrue + extra,
      skippedNoOp: 0,
    },
    estimatedRedundantNotifications: extra,
  };
}

async function runScenario(name, fn, { reactHookCount = 1, cartLines = 1 } = {}) {
  mocks.secureStore.clear();
  mocks.cartServer.reset();

  const cartStoreMod = await import('../store/cart.ts');
  const cartEngineMod = await import('../src/core/cart/cart-engine.ts');
  const { useCartStore, resetCartStateForTests } = cartStoreMod;
  const { cartEngine } = cartEngineMod;

  await resetCartStateForTests({ clearPersistedCart: true });
  await cartEngine.hydrate();

  const metrics = createMetrics();
  const store = useCartStore;
  const originalSetState = store.setState.bind(store);

  store.setState = (partial) => {
    const prev = store.getState();
    originalSetState(partial);
    const next = store.getState();
    if (next === prev) {
      metrics.syncFlagWrites.skippedNoOp += 1;
      return;
    }
    metrics.storeNotifications += 1;
    trackSyncFlags(prev, next, metrics);
    metrics.writes.push({
      pendingCartSync: next.pendingCartSync,
      isSyncingShopify: next.isSyncingShopify,
      lineCount: next.lines.length,
      qtyPendingKeys: Object.keys(next.quantitySyncPendingByVariantId).length,
    });
  };

  // Simulate global listeners (persistence + benefits)
  const unsubGlobal = store.subscribe((state, prev) => {
    metrics.globalListenerInvocations += 1;
    if (state.lines !== prev.lines) metrics.globalListenerEffective += 1;
    if (state.lines === prev.lines && !state.hasHydrated) return;
    if (state.lines === prev.lines) {
      // persistence early return; benefits checks line count
      const prevCount = prev.lines.reduce((n, l) => n + l.qty, 0);
      const nextCount = state.lines.reduce((n, l) => n + l.qty, 0);
      if (prevCount === nextCount) return;
    }
  });

  // Simulate React hooks: 1 cart screen shallow + (before) 2*N row hooks
  let lastHookSnapshot = null;
  const selectHookSlice = (s) => ({
    lines: s.lines,
    hasHydrated: s.hasHydrated,
    bagUnitCount: s.lines.reduce((n, l) => n + l.qty, 0),
    viewCartLineKey: s.lines.map((l) => `${l.variantId}:${l.qty}`).join('|'),
    quantitySyncPendingByVariantId: s.quantitySyncPendingByVariantId,
    pendingCartSync: s.pendingCartSync,
    isSyncingShopify: s.isSyncingShopify,
  });

  const unsubReact = store.subscribe((state) => {
    metrics.reactHookInvocations += reactHookCount;
    const snap = selectHookSlice(state);
    const shallowEqual =
      lastHookSnapshot &&
      snap.lines === lastHookSnapshot.lines &&
      snap.hasHydrated === lastHookSnapshot.hasHydrated &&
      snap.bagUnitCount === lastHookSnapshot.bagUnitCount &&
      snap.viewCartLineKey === lastHookSnapshot.viewCartLineKey &&
      snap.quantitySyncPendingByVariantId === lastHookSnapshot.quantitySyncPendingByVariantId &&
      snap.pendingCartSync === lastHookSnapshot.pendingCartSync &&
      snap.isSyncingShopify === lastHookSnapshot.isSyncingShopify;
    if (!shallowEqual) {
      metrics.reactHookReRenders += reactHookCount;
      lastHookSnapshot = snap;
    }
  });

  // Row hooks (before optimization only)
  const rowHookCount = Math.max(0, cartLines) * 2;
  let rowMetrics = { invocations: 0, reRenders: 0 };
  const unsubRows =
    rowHookCount > 0
      ? store.subscribe((state, prev) => {
          for (let i = 0; i < cartLines; i += 1) {
            rowMetrics.invocations += 2;
            const linesChanged = state.lines !== prev.lines;
            const pendingChanged =
              state.quantitySyncPendingByVariantId !== prev.quantitySyncPendingByVariantId;
            if (linesChanged || pendingChanged) rowMetrics.reRenders += 2;
          }
        })
      : () => {};

  await fn(cartEngine, store, metrics);

  unsubGlobal();
  unsubReact();
  unsubRows();

  return {
    scenario: name,
    cartLines,
    reactSubscriptions: reactHookCount + rowHookCount,
    ...metrics,
    rowHookInvocations: rowMetrics.invocations,
    rowHookReRenders: rowMetrics.reRenders,
    totalReactReRenders: metrics.reactHookReRenders + rowMetrics.reRenders,
  };
}

async function main() {
  const results = {};

  results.addNewLine = await runScenario(
    'addNewLine',
    async (cartEngine) => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      await wait(800);
    },
    { reactHookCount: 1, cartLines: 0 },
  );

  // Seed one line first for qty/remove scenarios
  results.qtyIncrease = await runScenario(
    'qtyIncrease',
    async (cartEngine, store, metrics) => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      await wait(800);
      assert.equal(store.getState().lines.length, 1);

      // Measure only the quantity bump + sync (not the seed add).
      metrics.storeNotifications = 0;
      metrics.globalListenerInvocations = 0;
      metrics.globalListenerEffective = 0;
      metrics.reactHookInvocations = 0;
      metrics.reactHookReRenders = 0;
      metrics.syncFlagWrites = {
        pendingCartSyncTrue: 0,
        pendingCartSyncFalse: 0,
        isSyncingShopifyTrue: 0,
        isSyncingShopifyFalse: 0,
        skippedNoOp: 0,
      };
      metrics.writes = [];

      cartEngine.nudgeQty(TEST_VARIANT_A, 1);
      await wait(900);
    },
    { reactHookCount: 1, cartLines: 1 },
  );

  results.removeItem = await runScenario(
    'removeItem',
    async (cartEngine, store, metrics) => {
      cartEngine.addItem(addLineInput(TEST_VARIANT_A, TEST_HANDLE_A));
      await wait(800);

      metrics.storeNotifications = 0;
      metrics.globalListenerInvocations = 0;
      metrics.globalListenerEffective = 0;
      metrics.reactHookInvocations = 0;
      metrics.reactHookReRenders = 0;
      metrics.syncFlagWrites = {
        pendingCartSyncTrue: 0,
        pendingCartSyncFalse: 0,
        isSyncingShopifyTrue: 0,
        isSyncingShopifyFalse: 0,
        skippedNoOp: 0,
      };
      metrics.writes = [];

      cartEngine.removeItem(TEST_VARIANT_A);
      await wait(800);
    },
    { reactHookCount: 1, cartLines: 1 },
  );

  // Before optimization subscription model on cart tab with N=1 line
  const beforeSubs = { cartTab: 5 + 2 * 1, global: 2, bagProvider: 2 };
  const afterSubs = { cartTab: 1, global: 2, bagProvider: 2 };

  const report = {
    measuredAt: new Date().toISOString(),
    subscriptions: {
      before: {
        cartTabWithOneLine: beforeSubs.cartTab,
        cartTabFormula: '5 + 2N',
        cartTabWithFiveLines: 5 + 2 * 5,
        globalModuleListeners: beforeSubs.global,
        bagProvider: beforeSubs.bagProvider,
        checkoutTab: 4,
      },
      after: {
        cartTabWithOneLine: afterSubs.cartTab,
        cartTabFormula: '1 (useCartScreenState)',
        cartTabWithFiveLines: 1,
        cartLineRow: 0,
        globalModuleListeners: afterSubs.global,
        bagProvider: afterSubs.bagProvider,
        checkoutTab: 4,
      },
    },
    operations: {},
  };

  for (const [key, after] of Object.entries(results)) {
    const before = simulateBeforeOptimizationRedundantWrites(after, key);
    report.operations[key] = {
      after: {
        storeNotifications: after.storeNotifications,
        globalListenerInvocations: after.globalListenerInvocations,
        globalListenerEffective: after.globalListenerEffective,
        reactSubscriptions: after.reactSubscriptions,
        reactHookInvocations: after.reactHookInvocations,
        reactHookReRenders: after.reactHookReRenders,
        rowHookInvocations: after.rowHookInvocations,
        rowHookReRenders: after.rowHookReRenders,
        totalReactReRenders: after.totalReactReRenders,
        syncFlagWrites: after.syncFlagWrites,
        writeTrace: after.writes,
      },
      beforeEstimated: {
        storeNotifications: before.storeNotifications,
        globalListenerInvocations: before.globalListenerInvocations,
        reactSubscriptions: 5 + 2 * after.cartLines,
        redundantPendingTrueWrites: before.estimatedRedundantNotifications,
        syncFlagWrites: before.syncFlagWrites,
      },
      deltas: {
        storeNotifications:
          before.storeNotifications - after.storeNotifications,
        globalListenerInvocations:
          before.globalListenerInvocations - after.globalListenerInvocations,
        reactSubscriptions: 5 + 2 * after.cartLines - after.reactSubscriptions,
        totalReactReRendersEstimate:
          before.totalReactReRenders - after.totalReactReRenders,
      },
    };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
