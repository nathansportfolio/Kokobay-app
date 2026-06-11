import type { WishlistEntry } from '@/types/wishlist';

function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

function parseAddedAtMs(addedAt: string): number {
  const ms = Date.parse(addedAt);
  return Number.isFinite(ms) ? ms : 0;
}

/** Remote API rows → local wishlist entries (newest first). */
export function wishlistEntriesFromRemoteItems(
  items: ReadonlyArray<{ productHandle: string; addedAt: string }>,
): WishlistEntry[] {
  const merged = mergeWishlistEntries(
    [],
    items.map((item) => ({
      handle: normalizeHandle(item.productHandle),
      addedAt: item.addedAt,
    })),
  );
  return merged;
}

/** Union local + remote — newest `addedAt` wins per handle; output newest-first. */
export function mergeWishlistEntries(
  local: readonly WishlistEntry[],
  remote: readonly WishlistEntry[],
): WishlistEntry[] {
  const byHandle = new Map<string, WishlistEntry>();

  for (const entry of [...local, ...remote]) {
    const handle = normalizeHandle(entry.handle);
    if (!handle) continue;
    const next: WishlistEntry = {
      handle,
      addedAt: entry.addedAt,
    };
    const existing = byHandle.get(handle);
    if (!existing || parseAddedAtMs(next.addedAt) >= parseAddedAtMs(existing.addedAt)) {
      byHandle.set(handle, next);
    }
  }

  return [...byHandle.values()].sort(
    (a, b) => parseAddedAtMs(b.addedAt) - parseAddedAtMs(a.addedAt),
  );
}

export function wishlistHandlesMissingOnRemote(
  merged: readonly WishlistEntry[],
  remote: readonly WishlistEntry[],
): string[] {
  const remoteHandles = new Set(remote.map((entry) => normalizeHandle(entry.handle)));
  return merged
    .map((entry) => normalizeHandle(entry.handle))
    .filter((handle) => handle && !remoteHandles.has(handle));
}
