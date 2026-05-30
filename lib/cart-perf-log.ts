/** Dev-only cart sync / network timing — filter Metro with `[CART PERF]` or `[CART FLOW]`. */

function enabled(): boolean {
  return __DEV__;
}

export function cartPerfLog(message: string): void {
  if (!enabled()) return;
  console.log(`[CART PERF] ${message}`);
}

export function cartFlowLog(method: string, path: string, durationMs: number): void {
  if (!enabled()) return;
  const route = path.split('?')[0] ?? path;
  console.log(`[CART FLOW] ${method} ${route} ${Math.round(durationMs)}ms`);
}
