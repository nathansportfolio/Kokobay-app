/** Canonical React Query key for a single product — always include market for cache isolation. */
export function productQueryKey(handle: string, marketKey: string) {
  return ['product', handle.trim(), marketKey] as const;
}
