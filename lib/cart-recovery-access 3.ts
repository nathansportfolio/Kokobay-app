/** Explicit opt-in for internal/TestFlight builds (`EXPO_PUBLIC_CART_RECOVERY=1`). */
function isCartRecoveryFlagEnabled(): boolean {
  const normalized = process.env.EXPO_PUBLIC_CART_RECOVERY?.trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}

/**
 * Dev/admin-only cart recovery tools.
 * - Always available in `__DEV__`
 * - Production: set `EXPO_PUBLIC_CART_RECOVERY=1` on internal EAS profiles only
 */
export function isCartRecoveryEnabled(): boolean {
  return __DEV__ || isCartRecoveryFlagEnabled();
}
