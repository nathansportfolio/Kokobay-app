/** React Query key for batched wishlist product previews. */
export function wishlistProductsQueryKey(marketKey: string, handles: readonly string[]): readonly [
  'wishlist-products',
  string,
  string,
] {
  const sorted = [...handles].sort().join(',');
  return ['wishlist-products', marketKey, sorted] as const;
}
