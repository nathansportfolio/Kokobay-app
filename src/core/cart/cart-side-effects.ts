import { scheduleAppBenefitsRefreshOnCartChange } from '@/src/core/query/app-benefits-query';
import { isAuthenticatedStatus } from '@/src/core/auth/types';
import { useAuthStore } from '@/store/auth-session';
import { useCartStore } from '@/store/cart';

type CartLinesSnapshot = {
  lines: { qty: number }[];
  hasHydrated: boolean;
};

type CartStoreLike = {
  getState: () => CartLinesSnapshot;
  subscribe: (listener: (state: CartLinesSnapshot, prev: CartLinesSnapshot) => void) => () => void;
};

function lineCount(lines: readonly { qty: number }[]): number {
  return lines.reduce((total, line) => total + line.qty, 0);
}

/**
 * Cart workflow side effects — benefits refresh when line count changes.
 * Call once at app startup from `AppProviders`.
 */
export function startCartEngine(useCartStoreRef: CartStoreLike = useCartStore): () => void {
  let prevCount = lineCount(useCartStoreRef.getState().lines);

  return useCartStoreRef.subscribe((state) => {
    if (!state.hasHydrated) return;

    const nextCount = lineCount(state.lines);
    if (nextCount === prevCount) return;
    prevCount = nextCount;

    const { accessToken, status } = useAuthStore.getState();
    const token = isAuthenticatedStatus(status) ? accessToken : undefined;
    scheduleAppBenefitsRefreshOnCartChange(token);
  });
}

/** @deprecated Use {@link startCartEngine} */
export const startCartSideEffects = startCartEngine;
