/** Dev-only fast quantity sync logs — filter Metro with `[CART FAST PATH]`. */

function enabled(): boolean {
  return __DEV__;
}

export function cartFastPathLog(message: string): void {
  if (!enabled()) return;
  console.log(`[CART FAST PATH] ${message}`);
}
