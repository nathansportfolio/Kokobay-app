/** Foreground resume cart sync — skip only when local state proves sync is unnecessary. */

export const CART_RESUME_SKIP_SYNC_WITHIN_MS = 5 * 60_000;

export type CartResumeSyncSnapshot = {
  isCartDirty: boolean;
  cartRevision: number;
  lastSyncedRevision: number;
  lastSyncAgeMs: number | null;
  hasPendingMutations: boolean;
};

export type CartResumeSyncDecision = CartResumeSyncSnapshot & {
  skip: boolean;
  reason: string;
};

export function decideCartForegroundResumeSync(
  input: CartResumeSyncSnapshot,
): CartResumeSyncDecision {
  const recentlySynced =
    input.lastSyncAgeMs !== null &&
    input.lastSyncAgeMs < CART_RESUME_SKIP_SYNC_WITHIN_MS;

  if (input.isCartDirty) {
    return { ...input, skip: false, reason: 'cart_dirty' };
  }

  if (!input.hasPendingMutations && recentlySynced) {
    return { ...input, skip: true, reason: 'clean_recently_synced' };
  }

  if (!input.hasPendingMutations) {
    return { ...input, skip: true, reason: 'clean' };
  }

  if (!input.isCartDirty && input.hasPendingMutations && recentlySynced) {
    return {
      ...input,
      skip: true,
      reason: 'stale_pending_flags_recently_synced',
    };
  }

  return { ...input, skip: false, reason: 'pending_mutations' };
}
