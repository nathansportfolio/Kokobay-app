export type RenderTraceLabel =
  | 'Home'
  | 'Cart'
  | 'CheckoutBar'
  | 'BottomTabs'
  | 'ProductCard';

const LABELS: RenderTraceLabel[] = [
  'Home',
  'Cart',
  'CheckoutBar',
  'BottomTabs',
  'ProductCard',
];

const counts = new Map<RenderTraceLabel, number>();

export function isRenderTraceEnabled(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_RENDER_TRACE === '1';
}

export function recordRenderTrace(label: RenderTraceLabel): void {
  if (!isRenderTraceEnabled()) return;
  counts.set(label, (counts.get(label) ?? 0) + 1);
  console.log('[RENDER]', label);
}

export function getRenderTraceCounts(): Record<RenderTraceLabel, number> {
  const out = {} as Record<RenderTraceLabel, number>;
  for (const label of LABELS) {
    out[label] = counts.get(label) ?? 0;
  }
  return out;
}

export function resetRenderTraceCounts(): void {
  counts.clear();
}

/** Log per-label totals since last flush, then reset. */
export function flushRenderTraceSummary(reason: string): void {
  if (!isRenderTraceEnabled()) return;
  const summary = getRenderTraceCounts();
  const total = LABELS.reduce((sum, label) => sum + summary[label], 0);
  if (total === 0) return;
  console.log('[RENDER SUMMARY]', { reason, ...summary });
  resetRenderTraceCounts();
}
