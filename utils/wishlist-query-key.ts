/** Stable React Query key — handles are passed in `queryFn`, not embedded in the key. */
export function wishlistProductsQueryKey(marketKey: string): readonly ['wishlist-products', string] {
  return ['wishlist-products', marketKey] as const;
}

/** Compact fingerprint so React Query refetches after debounced handle churn without a long key. */
export function wishlistHandlesRevision(handles: readonly string[]): number {
  let hash = 2_166_136_261;
  for (const handle of handles) {
    for (let i = 0; i < handle.length; i += 1) {
      hash ^= handle.charCodeAt(i);
      hash = Math.imul(hash, 16_777_619);
    }
  }
  return hash >>> 0;
}

export function wishlistProductsQueryKeyWithRevision(
  marketKey: string,
  handles: readonly string[],
): readonly ['wishlist-products', string, number, number] {
  return [...wishlistProductsQueryKey(marketKey), handles.length, wishlistHandlesRevision(handles)] as const;
}
