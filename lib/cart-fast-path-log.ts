export function cartFastPathLog(message: string): void {
  if (__DEV__) console.log(`[cart-fast] ${message}`);
}
