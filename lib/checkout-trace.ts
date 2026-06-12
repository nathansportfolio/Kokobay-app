/** Header sent on cart API calls during an active checkout trace. */
export const CHECKOUT_TRACE_HEADER = 'x-trace-id';

let activeTraceId: string | null = null;

export function createCheckoutTraceId(): string {
  return `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Begin checkout trace when Checkout is tapped. Returns the traceId. */
export function startCheckoutTrace(): string {
  activeTraceId = createCheckoutTraceId();
  return activeTraceId;
}

export function getCheckoutTraceId(): string | null {
  return activeTraceId;
}

/** Clear the active trace after checkout WebView has loaded (or flow ends). */
export function endCheckoutTrace(): void {
  activeTraceId = null;
}

/** Attach to cart API requests while a checkout trace is active. */
export function checkoutTraceRequestHeaders(): Record<string, string> {
  const traceId = activeTraceId;
  if (!traceId) return {};
  return { [CHECKOUT_TRACE_HEADER]: traceId };
}

export function logCheckoutTrace(step: string, detail: Record<string, unknown> = {}): void {
  const traceId = activeTraceId;
  if (!traceId) return;
  console.log(`[CHECKOUT_TRACE] ${step}`, { traceId, ...detail });
}
