/** Dev-only cart sync coalescing — filter Metro with `[CART COALESCE]`. */

function enabled(): boolean {
  return __DEV__;
}

export function cartCoalesceLog(message: string): void {
  if (!enabled()) return;
  console.log(`[CART COALESCE] ${message}`);
}
