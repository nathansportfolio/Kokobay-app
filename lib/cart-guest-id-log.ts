/** Tracks guest id across a session to surface mismatches during cart ownership debugging. */
let sessionGuestId: string | null = null;

function guestPrefix(guestId: string | null | undefined): string {
  const trimmed = guestId?.trim();
  if (!trimmed) return '(none)';
  return `${trimmed.slice(0, 8)}…`;
}

export function resetCartGuestIdSessionLog(): void {
  sessionGuestId = null;
}

export function logCartGuestId(
  source: string,
  guestId: string | null | undefined,
  detail?: Record<string, unknown>,
): void {
  const trimmed = guestId?.trim() || null;
  const prefix = guestPrefix(trimmed);

  if (trimmed && sessionGuestId && sessionGuestId !== trimmed) {
    console.warn(
      `[CART_GUEST_ID] MISMATCH source=${source} guest=${prefix} expected=${guestPrefix(sessionGuestId)}`,
      detail ?? '',
    );
  } else if (trimmed && !sessionGuestId) {
    sessionGuestId = trimmed;
  }

  console.log(`[CART_GUEST_ID] source=${source} guest=${prefix}`, detail ?? '');
}
