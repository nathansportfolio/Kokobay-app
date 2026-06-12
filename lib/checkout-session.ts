const PRESYNC_TOKEN_TTL_MS = 30_000;

type CheckoutPreSyncToken = {
  synced: boolean;
  syncedAt: number;
  cartRevision: number;
};

let preSyncToken: CheckoutPreSyncToken | null = null;

/** Mark cart as freshly synced by openCheckoutFromBag before navigating to checkout. */
export function setCheckoutPreSyncToken(cartRevision: number): void {
  preSyncToken = {
    synced: true,
    syncedAt: Date.now(),
    cartRevision,
  };
}

export function clearCheckoutPreSyncToken(): void {
  preSyncToken = null;
}

export function checkoutPreSyncTokenAgeMs(): number | null {
  if (!preSyncToken?.synced) return null;
  return Date.now() - preSyncToken.syncedAt;
}

/** Why checkout screen bootstrap sync is still required (when skip is false). */
export function checkoutBootstrapRequiredReason(cartRevision: number): string {
  if (!preSyncToken) return 'no_presync_token';
  if (!preSyncToken.synced) return 'presync_not_marked';
  const ageMs = Date.now() - preSyncToken.syncedAt;
  if (ageMs > PRESYNC_TOKEN_TTL_MS) return 'presync_expired';
  if (preSyncToken.cartRevision !== cartRevision) return 'cart_revision_changed';
  return 'unknown';
}

/** Skip checkout screen bootstrap when bag checkout already synced the same revision. */
export function shouldSkipCheckoutBootstrap(cartRevision: number): boolean {
  if (!preSyncToken?.synced) return false;
  const ageMs = Date.now() - preSyncToken.syncedAt;
  if (ageMs > PRESYNC_TOKEN_TTL_MS) return false;
  return preSyncToken.cartRevision === cartRevision;
}
