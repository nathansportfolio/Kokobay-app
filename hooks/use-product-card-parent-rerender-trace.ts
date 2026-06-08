import { useRef } from 'react';

function diffParentRerenderReason(
  prev: Record<string, unknown> | null,
  next: Record<string, unknown>,
): string {
  if (!prev) return 'mount';
  const reasons: string[] = [];
  for (const key of Object.keys(next)) {
    if (prev[key] !== next[key]) {
      reasons.push(key);
    }
  }
  return reasons.length ? reasons.join(',') : 'unknown';
}

/**
 * Dev-only React DevTools-style parent rerender log.
 * Emits `[PRODUCT_CARD_PARENT_RERENDER] component=… reason=…` on every render.
 */
export function useProductCardParentRerenderTrace(
  component: string,
  snapshot: Record<string, unknown>,
): void {
  if (!__DEV__) return;

  const prevRef = useRef<Record<string, unknown> | null>(null);
  const reason = diffParentRerenderReason(prevRef.current, snapshot);
  console.log('[PRODUCT_CARD_PARENT_RERENDER]', `component=${component}`, `reason=${reason}`);
  prevRef.current = snapshot;
}
