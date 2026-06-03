import { isDevAuditFlagEnabled } from '@/lib/dev-audit-flag';
import {
  isForegroundAuditEnabled,
  isForegroundAuditWindowActive,
  recordForegroundAuditRender,
  type ForegroundRenderLabel,
} from '@/lib/foreground-audit';
import {
  isJsFreezeAuditEnabled,
  recordJsFreezeRender,
  type JsFreezeRenderStormLabel,
} from '@/lib/js-freeze-audit';

export type RenderTraceLabel = ForegroundRenderLabel;

const LABELS: RenderTraceLabel[] = [
  'Home',
  'Collection',
  'Product',
  'Cart',
  'CheckoutBar',
  'BottomTabs',
  'Header',
  'ProductCard',
];

const STORM_LABELS = new Set<JsFreezeRenderStormLabel>([
  'ProductCard',
  'Home',
  'Product',
  'Cart',
  'CheckoutBar',
  'BottomTabs',
]);

const counts = new Map<RenderTraceLabel, number>();

/** Dev-only — set `EXPO_PUBLIC_RENDER_TRACE=1` to enable. */
export function isRenderTraceEnabled(): boolean {
  return isDevAuditFlagEnabled(process.env.EXPO_PUBLIC_RENDER_TRACE);
}

export function recordRenderTrace(label: RenderTraceLabel): void {
  if (isRenderTraceEnabled()) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
    console.log('[RENDER]', label);
  }
  if (isForegroundAuditEnabled() && isForegroundAuditWindowActive()) {
    recordForegroundAuditRender(label);
  }
  if (isJsFreezeAuditEnabled() && STORM_LABELS.has(label as JsFreezeRenderStormLabel)) {
    recordJsFreezeRender(label as JsFreezeRenderStormLabel);
  }
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
