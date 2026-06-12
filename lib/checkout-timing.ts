import { getCheckoutTraceId } from '@/lib/checkout-trace';

export const CHECKOUT_TIMING_MILESTONES = [
  'checkout_button_pressed',
  'checkout_sync_started',
  'checkout_sync_finished',
  'checkout_url_ready',
  'checkout_navigation_start',
  'checkout_screen_mounted',
  'checkout_webview_mounted',
  'checkout_webview_load_start',
  'checkout_webview_first_response',
  'checkout_webview_load_end',
] as const;

export type CheckoutTimingMilestone = (typeof CHECKOUT_TIMING_MILESTONES)[number];

type CheckoutTimingState = {
  marks: Partial<Record<CheckoutTimingMilestone, number>>;
  finished: boolean;
};

let state: CheckoutTimingState | null = null;

function elapsed(from?: number, to?: number): number | null {
  if (from == null || to == null) return null;
  return to - from;
}

/** Begin a new checkout timing attempt (marks `checkout_button_pressed`). */
export function startCheckoutTiming(): void {
  if (!__DEV__) return;

  const now = Date.now();
  state = {
    marks: { checkout_button_pressed: now },
    finished: false,
  };
}

/** Record a milestone timestamp for the active checkout attempt. */
export function markCheckoutTiming(name: CheckoutTimingMilestone | string): void {
  if (!__DEV__ || !state || state.finished) return;
  if (!(CHECKOUT_TIMING_MILESTONES as readonly string[]).includes(name)) return;

  const milestone = name as CheckoutTimingMilestone;
  if (state.marks[milestone] != null) return;

  state.marks[milestone] = Date.now();
}

/** Log one summary for the active attempt when Shopify checkout has fully loaded. */
export function finishCheckoutTiming(): void {
  if (!__DEV__ || !state || state.finished) return;

  state.finished = true;

  const marks = state.marks;
  const start = marks.checkout_button_pressed;
  if (start == null) return;

  const totalMs =
    elapsed(start, marks.checkout_webview_load_end) ??
    elapsed(start, Date.now()) ??
    0;

  const syncMs = elapsed(marks.checkout_sync_started, marks.checkout_sync_finished);
  const navigationMs = elapsed(marks.checkout_navigation_start, marks.checkout_screen_mounted);
  const webViewBootMs = elapsed(marks.checkout_screen_mounted, marks.checkout_webview_mounted);
  const shopifyLoadMs = elapsed(
    marks.checkout_webview_load_start,
    marks.checkout_webview_load_end,
  );

  const fullBreakdown: Partial<Record<CheckoutTimingMilestone, number>> = {};
  for (const milestone of CHECKOUT_TIMING_MILESTONES) {
    const ts = marks[milestone];
    if (ts != null) {
      fullBreakdown[milestone] = ts - start;
    }
  }

  console.log('[CHECKOUT_TIMING]', {
    traceId: getCheckoutTraceId(),
    totalMs,
    syncMs,
    navigationMs,
    webViewBootMs,
    shopifyLoadMs,
    fullBreakdown,
  });

  state = null;
}
