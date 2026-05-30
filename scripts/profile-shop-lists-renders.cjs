/**
 * Bag / Wishlist context render profiler (Node + react-test-renderer).
 * Run: node scripts/profile-shop-lists-renders.cjs
 *
 * Compares unified ShopLists context (before) vs split Bag + Wishlist (after).
 */

const React = require('react');
const { act } = require('react-test-renderer');
const { create } = require('zustand');
const { useShallow } = require('zustand/react/shallow');

const h = React.createElement;
const PLP_TILE_COUNT = 18;
const BURST = 10;

function shopifyVariantKey(variantId) {
  return String(variantId).trim();
}

function selectCartBagUnitCount(s) {
  return s.lines.reduce((n, l) => n + l.qty, 0);
}

function useCartBagUnitCount() {
  return useCartStore(selectCartBagUnitCount);
}

function useCartBagLineKeys() {
  return useCartStore(
    useShallow((s) =>
      s.lines.map((l) => `${l.handle}::${shopifyVariantKey(l.variantId)}`),
    ),
  );
}

const useCartStore = create((set) => ({
  lines: [],
  addToCart: ({ handle, variantId, qty }) => {
    set((s) => {
      const idx = s.lines.findIndex(
        (l) => l.handle === handle && l.variantId === variantId,
      );
      if (idx >= 0) {
        const next = [...s.lines];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return { lines: next };
      }
      return {
        lines: [...s.lines, { handle, variantId, qty, shopifyLineId: `line-${variantId}` }],
      };
    });
  },
  updateQuantity: (variantId, qty) => {
    set((s) => ({
      lines:
        qty < 1
          ? s.lines.filter((l) => l.variantId !== variantId)
          : s.lines.map((l) => (l.variantId === variantId ? { ...l, qty } : l)),
    }));
  },
  removeItem: (variantId) => {
    set((s) => ({ lines: s.lines.filter((l) => l.variantId !== variantId) }));
  },
}));

function buildProviders(mode) {
  const BagContext = React.createContext(null);
  const BagActionsContext = React.createContext(null);
  const BagStateContext = React.createContext(null);
  const WishlistContext = React.createContext(null);
  const UnifiedContext = React.createContext(null);

  function BagActionsProvider({ children }) {
    const addToBag = React.useCallback((params) => {
      useCartStore.getState().addToCart(params);
    }, []);
    const value = React.useMemo(() => ({ addToBag }), [addToBag]);
    return h(BagActionsContext.Provider, { value }, children);
  }

  function BagStateProvider({ children }) {
    const bagUnitCount = useCartBagUnitCount();
    const bagLineKeys = useCartBagLineKeys();
    const isInBag = React.useCallback(
      (handle, variantId) => {
        const key = `${handle}::${shopifyVariantKey(variantId)}`;
        return bagLineKeys.includes(key);
      },
      [bagLineKeys],
    );
    const value = React.useMemo(
      () => ({ bagUnitCount, isInBag, bagLineKeys }),
      [bagUnitCount, isInBag, bagLineKeys],
    );
    return h(BagStateContext.Provider, { value }, children);
  }

  function BagProviderCombined({ children }) {
    const bagUnitCount = useCartBagUnitCount();
    const bagLineKeys = useCartBagLineKeys();
    const addToBag = React.useCallback((params) => {
      useCartStore.getState().addToCart(params);
    }, []);
    const isInBag = React.useCallback(
      (handle, variantId) => {
        const key = `${handle}::${shopifyVariantKey(variantId)}`;
        return bagLineKeys.includes(key);
      },
      [bagLineKeys],
    );
    const value = React.useMemo(
      () => ({ addToBag, bagUnitCount, isInBag, bagLineKeys }),
      [addToBag, bagUnitCount, isInBag, bagLineKeys],
    );
    return h(BagContext.Provider, { value }, children);
  }

  function BagProvider({ children }) {
    if (mode === 'split-actions') {
      return h(BagActionsProvider, null, h(BagStateProvider, null, children));
    }
    return h(BagProviderCombined, null, children);
  }

  function WishlistProvider({ children }) {
    const [wishlistSet] = React.useState(() => new Set(['seed-wishlist-item']));
    const wishlistHandles = React.useMemo(() => [...wishlistSet].sort(), [wishlistSet]);
    const wishlistCount = wishlistHandles.length;
    const isWishlisted = React.useCallback(
      (handle) => wishlistSet.has(handle.trim()),
      [wishlistSet],
    );
    const toggleWishlist = React.useCallback(() => {}, []);
    const value = React.useMemo(
      () => ({
        wishlistHandles,
        wishlistCount,
        isWishlisted,
        toggleWishlist,
        wishlistHydrated: true,
        reloadWishlist: async () => {},
      }),
      [wishlistHandles, wishlistCount, isWishlisted, toggleWishlist],
    );
    return h(WishlistContext.Provider, { value }, children);
  }

  function UnifiedShopListsProvider({ children }) {
    const bagUnitCount = useCartBagUnitCount();
    const bagLineKeys = useCartBagLineKeys();
    const [wishlistSet] = React.useState(() => new Set(['seed-wishlist-item']));
    const addToBag = React.useCallback((params) => {
      useCartStore.getState().addToCart(params);
    }, []);
    const isInBag = React.useCallback(
      (handle, variantId) => {
        const key = `${handle}::${shopifyVariantKey(variantId)}`;
        return bagLineKeys.includes(key);
      },
      [bagLineKeys],
    );
    const wishlistHandles = React.useMemo(() => [...wishlistSet].sort(), [wishlistSet]);
    const wishlistCount = wishlistHandles.length;
    const isWishlisted = React.useCallback(
      (handle) => wishlistSet.has(handle.trim()),
      [wishlistSet],
    );
    const toggleWishlist = React.useCallback(() => {}, []);
    const value = React.useMemo(
      () => ({
        addToBag,
        bagUnitCount,
        isInBag,
        bagLineKeys,
        wishlistHandles,
        wishlistCount,
        isWishlisted,
        toggleWishlist,
        wishlistHydrated: true,
        reloadWishlist: async () => {},
      }),
      [
        addToBag,
        bagUnitCount,
        isInBag,
        bagLineKeys,
        wishlistHandles,
        wishlistCount,
        isWishlisted,
        toggleWishlist,
      ],
    );
    return h(UnifiedContext.Provider, { value }, children);
  }

  function useBag() {
    const ctx = React.useContext(BagContext);
    if (!ctx) throw new Error('useBag requires BagProvider');
    return ctx;
  }

  function useBagActions() {
    const ctx = React.useContext(BagActionsContext);
    if (!ctx) throw new Error('useBagActions requires BagProvider');
    return ctx;
  }

  function useBagState() {
    const ctx = React.useContext(BagStateContext);
    if (!ctx) throw new Error('useBagState requires BagProvider');
    return ctx;
  }

  function useWishlist() {
    const ctx = React.useContext(WishlistContext);
    if (!ctx) throw new Error('useWishlist requires WishlistProvider');
    return ctx;
  }

  function useShopLists() {
    const ctx = React.useContext(UnifiedContext);
    if (!ctx) throw new Error('useShopLists requires unified provider');
    return ctx;
  }

  function RootProvider({ children }) {
    if (mode === 'split' || mode === 'split-actions') {
      return h(WishlistProvider, null, h(BagProvider, null, children));
    }
    return h(UnifiedShopListsProvider, null, children);
  }

  return {
    RootProvider,
    useBag,
    useBagActions,
    useBagState,
    useWishlist,
    useShopLists,
    mode,
  };
}

function createAppTree(hooks) {
  const { useBag, useBagActions, useBagState, useWishlist, useShopLists, mode } = hooks;
  const usesSplitBag = mode === 'split' || mode === 'split-actions';
  const usesBagActionsOnly = mode === 'split-actions';
  const renderCounts = new Map();

  function trackRender(name) {
    renderCounts.set(name, (renderCounts.get(name) ?? 0) + 1);
  }

  function createTracked(name, body) {
    return function Tracked() {
      trackRender(name);
      return body();
    };
  }

  const TabLayout = createTracked('TabLayout', () => {
    if (usesSplitBag) {
      const { bagUnitCount } = usesBagActionsOnly ? useBagState() : useBag();
      const { wishlistCount } = useWishlist();
      return h('div', null, `${bagUnitCount}-${wishlistCount}`);
    }
    const { bagUnitCount, wishlistCount } = useShopLists();
    return h('div', null, `${bagUnitCount}-${wishlistCount}`);
  });

  const WishlistScreen = createTracked('WishlistScreen', () => {
    const { wishlistHandles, wishlistHydrated } = usesSplitBag
      ? useWishlist()
      : useShopLists();
    return h('div', null, `${wishlistHydrated ? wishlistHandles.length : 0}`);
  });

  const PdpScreen = createTracked('PdpScreen', () => {
    if (usesSplitBag) {
      const { addToBag } = usesBagActionsOnly ? useBagActions() : useBag();
      const { isWishlisted } = useWishlist();
      return h('div', null, `${typeof addToBag}-${String(isWishlisted('h1'))}`);
    }
    const { addToBag, isWishlisted } = useShopLists();
    return h('div', null, `${typeof addToBag}-${String(isWishlisted('h1'))}`);
  });

  const productCards = Array.from({ length: PLP_TILE_COUNT }, (_, i) => {
    const QuickAdd = createTracked(`QuickAddToBag#${i}`, () => {
      const { addToBag } = usesSplitBag
        ? usesBagActionsOnly
          ? useBagActions()
          : useBag()
        : useShopLists();
      return h('div', null, typeof addToBag);
    });
    return createTracked(`ProductCard#${i}`, () => {
      const { wishlistHandles } = usesSplitBag ? useWishlist() : useShopLists();
      const wishlisted = wishlistHandles.includes(`handle-${i}`);
      return h('div', null, wishlisted ? '1' : '0', h(QuickAdd));
    });
  });

  const AppRouteShell = createTracked('AppRouteShell', () =>
    h(
      'div',
      null,
      h(TabLayout),
      h(WishlistScreen),
      h(PdpScreen),
      h('div', null, ...productCards.map((Card, i) => h(Card, { key: i }))),
    ),
  );

  function providerLabel() {
    if (mode === 'unified') return 'UnifiedProvider';
    if (mode === 'split-actions') return 'SplitActionsProviders';
    return 'SplitProviders';
  }

  function RootProviderTracked() {
    trackRender(providerLabel());
    return h(hooks.RootProvider, null, h(AppRouteShell));
  }

  const consumerNames = [
    providerLabel(),
    'AppRouteShell',
    'TabLayout',
    'WishlistScreen',
    'PdpScreen',
    ...Array.from({ length: PLP_TILE_COUNT }, (_, i) => `ProductCard#${i}`),
    ...Array.from({ length: PLP_TILE_COUNT }, (_, i) => `QuickAddToBag#${i}`),
  ];

  function consumerRows() {
    return consumerNames
      .map((name) => ({ name, total: renderCounts.get(name) ?? 0 }))
      .sort((a, b) => b.total - a.total);
  }

  function runCartBurst(label, cartAction) {
    renderCounts.clear();
    const testRenderer = require('react-test-renderer');
    let renderer;
    act(() => {
      renderer = testRenderer.create(h(RootProviderTracked));
    });
    const mountSnapshot = new Map(renderCounts);
    cartAction();
    const rows = consumerRows().map((row) => ({
      ...row,
      burstDelta: row.total - (mountSnapshot.get(row.name) ?? 0),
    }));
    const burstTotal = rows.reduce((n, r) => n + r.burstDelta, 0);
    const providerKey = providerLabel();
    const consumerRenders = rows
      .filter((r) => r.name !== providerKey && r.name !== 'AppRouteShell')
      .reduce((n, r) => n + r.burstDelta, 0);
    act(() => renderer.unmount());
    return {
      label,
      mode,
      burstTotal,
      consumerRenders,
      rows: rows.sort((a, b) => b.burstDelta - a.burstDelta),
      over10: rows.filter((r) => r.burstDelta > 10).map((r) => r.name),
    };
  }

  return { runCartBurst };
}

function runAddToCartBurst(app) {
  return app.runCartBurst('addToCart x10', () => {
    for (let i = 0; i < BURST; i += 1) {
      act(() => {
        useCartStore.getState().addToCart({
          handle: `new-${i}`,
          variantId: `new-variant-${i}`,
          qty: 1,
        });
      });
    }
  });
}

function runUpdateQuantityBurst(app) {
  useCartStore.setState({
    lines: Array.from({ length: BURST }, (_, j) => ({
      handle: `handle-${j}`,
      variantId: `variant-${j}`,
      qty: 1,
      shopifyLineId: `line-${j}`,
    })),
  });
  return app.runCartBurst('updateQuantity x10', () => {
    for (let i = 0; i < BURST; i += 1) {
      act(() => {
        useCartStore.getState().updateQuantity(`variant-${i}`, 2);
      });
    }
  });
}

function runRemoveItemBurst(app) {
  useCartStore.setState({
    lines: Array.from({ length: BURST }, (_, j) => ({
      handle: `handle-${j}`,
      variantId: `variant-${j}`,
      qty: 1,
      shopifyLineId: `line-${j}`,
    })),
  });
  return app.runCartBurst('removeItem x10', () => {
    for (let i = 0; i < BURST; i += 1) {
      act(() => {
        useCartStore.getState().removeItem(`variant-${i}`);
      });
    }
  });
}

function printBurstReport(result) {
  console.log(`\n--- ${result.label} (${result.mode}) ---`);
  console.log(`Consumer renders: ${result.consumerRenders}`);
  console.log(`Total tracked renders: ${result.burstTotal}`);
  console.log(
    result.over10.length
      ? `>10 renders: ${result.over10.join(', ')}`
      : '>10 renders: none',
  );
  for (const row of result.rows) {
    if (row.burstDelta > 0) console.log(`  ${row.name.padEnd(22)} +${row.burstDelta}`);
  }
}

const unifiedHooks = buildProviders('unified');
const splitHooks = buildProviders('split');
const splitActionsHooks = buildProviders('split-actions');
const unifiedApp = createAppTree(unifiedHooks);
const splitApp = createAppTree(splitHooks);
const splitActionsApp = createAppTree(splitActionsHooks);

console.log('Bag context profiling (PLP tiles: %d, burst: %d cart ops)', PLP_TILE_COUNT, BURST);

console.log('\n========== BEFORE: unified ShopLists context ==========');
const beforeAdd = runAddToCartBurst(unifiedApp);
[beforeAdd].forEach(printBurstReport);

useCartStore.setState({ lines: [] });

console.log('\n========== AFTER wishlist/bag split (combined BagContext) ==========');
const afterSplitAdd = runAddToCartBurst(splitApp);
[afterSplitAdd].forEach(printBurstReport);

useCartStore.setState({ lines: [] });

console.log('\n========== AFTER BagActions + BagState split ==========');
const afterActionsAdd = runAddToCartBurst(splitActionsApp);
const afterActionsUpdate = runUpdateQuantityBurst(splitActionsApp);
const afterActionsRemove = runRemoveItemBurst(splitActionsApp);
[afterActionsAdd, afterActionsUpdate, afterActionsRemove].forEach(printBurstReport);

function pctReduction(before, after) {
  return Math.round((1 - after / before) * 100);
}

const baseline = beforeAdd.consumerRenders;

console.log('\n========== COMPARISON (addToCart x10 consumer renders) ==========');
console.log(`Before (unified):              ${baseline}`);
console.log(`After wishlist/bag split:      ${afterSplitAdd.consumerRenders}`);
console.log(`After actions/state split:     ${afterActionsAdd.consumerRenders}`);
console.log(
  `Reduction vs 390 (wishlist split): ${pctReduction(baseline, afterSplitAdd.consumerRenders)}%`,
);
console.log(
  `Reduction vs 390 (actions split):  ${pctReduction(baseline, afterActionsAdd.consumerRenders)}%`,
);
console.log(
  `Reduction vs 200 (actions split):  ${pctReduction(afterSplitAdd.consumerRenders, afterActionsAdd.consumerRenders)}%`,
);

console.log('\n========== Top render contributors (actions/state, addToCart x10) ==========');
for (const row of afterActionsAdd.rows.filter((r) => r.burstDelta > 0).slice(0, 8)) {
  console.log(`  ${row.name.padEnd(22)} +${row.burstDelta}`);
}

console.log('\n========== Verification ==========');
const quickAddTotal = afterActionsAdd.rows
  .filter((r) => r.name.startsWith('QuickAddToBag#'))
  .reduce((n, r) => n + r.burstDelta, 0);
const pdpDelta = afterActionsAdd.rows.find((r) => r.name === 'PdpScreen')?.burstDelta ?? 0;
console.log(
  `QuickAddToBag total burst renders: ${quickAddTotal} (expected 0)`,
);
console.log(`PdpScreen burst renders: ${pdpDelta} (expected 0)`);
console.log(
  `ProductCard burst renders: ${
    afterActionsAdd.rows
      .filter((r) => r.name.startsWith('ProductCard#'))
      .reduce((n, r) => n + r.burstDelta, 0)
  } (expected 0)`,
);

console.log('\n========== Remaining shared dependencies ==========');
console.log('- TabLayout: useBagState() + useWishlist() — re-renders on bag count (badge)');
console.log('- BagStateProvider: subscribes to Zustand bagUnitCount / bagLineKeys');
console.log('- QuickAddToBag: useBagActions() only — stable context value on cart edits');
