import type { Href } from 'expo-router';

import { collectionHref } from '@/utils/collection-navigation';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import type { Collection } from '@/types/shopify';

/** Live Shopify collection handle from the Koko Bay web API. */
export const LIVE_NEW_IN_COLLECTION_HANDLE = 'all-new-in';

/** Legacy editorial collection handle (alias for live `all-new-in`). */
export const EDITORIAL_NEW_IN_COLLECTION_HANDLE = 'new-in';

const NEW_IN_ALIASES = new Set([
  LIVE_NEW_IN_COLLECTION_HANDLE,
  EDITORIAL_NEW_IN_COLLECTION_HANDLE,
]);

export function isNewInCollectionHandle(handle: string): boolean {
  return NEW_IN_ALIASES.has(handle.trim().toLowerCase());
}

/** Canonical handle for sorting and deduping (live handle wins). */
export function canonicalCollectionHandle(handle: string): string {
  const h = handle.trim();
  if (isNewInCollectionHandle(h)) return LIVE_NEW_IN_COLLECTION_HANDLE;
  if (h === 'best-selling-products') return 'best-sellers';
  if (h === 'loungewear') return 'loungewear-1';
  return h;
}

/** Handle to pass to Koko Bay `/api/collections/{handle}`. */
export function resolveCollectionHandleForApi(handle: string): string {
  const h = handle.trim();
  if (!h) return h;
  if (isKokobayWebProductsConfigured() && isNewInCollectionHandle(h)) {
    return LIVE_NEW_IN_COLLECTION_HANDLE;
  }
  return h;
}

/** Preferred in-app route segment for “New in”. */
export function primaryNewInCollectionHandle(): string {
  return isKokobayWebProductsConfigured()
    ? LIVE_NEW_IN_COLLECTION_HANDLE
    : EDITORIAL_NEW_IN_COLLECTION_HANDLE;
}

export function newInCollectionHref(returnTo?: string): Href {
  return collectionHref(primaryNewInCollectionHandle(), returnTo);
}

export function collectionHandlesMatch(a: string, b: string): boolean {
  return canonicalCollectionHandle(a) === canonicalCollectionHandle(b);
}

/** Drop editorial duplicates when the live collection is already present. */
export function dedupeCollectionAliases(collections: Collection[]): Collection[] {
  const handles = new Set(collections.map((c) => c.handle));
  return collections.filter((c) => {
    if (handles.has(LIVE_NEW_IN_COLLECTION_HANDLE) && c.handle === EDITORIAL_NEW_IN_COLLECTION_HANDLE) {
      return false;
    }
    if (handles.has('best-sellers') && c.handle === 'best-selling-products') return false;
    if (handles.has('loungewear-1') && c.handle === 'loungewear') return false;
    return true;
  });
}
