import { COLLECTION_PRIORITY_GROUPS } from '@/constants/collection-order';
import { ALL_PRODUCTS_COLLECTION, ALL_PRODUCTS_COLLECTION_HANDLE } from '@/constants/catalog';
import type { Collection } from '@/types/shopify';
import { canonicalCollectionHandle, dedupeCollectionAliases } from '@/utils/collection-handles';

function cloneCollection(c: Collection): Collection {
  return {
    ...c,
    image: c.image ? { ...c.image } : null,
  };
}

export function collectionDisplayRank(handle: string): number {
  const canonical = canonicalCollectionHandle(handle);
  for (let i = 0; i < COLLECTION_PRIORITY_GROUPS.length; i++) {
    const group = COLLECTION_PRIORITY_GROUPS[i];
    if (group.includes(handle) || group.includes(canonical)) return i;
  }
  return COLLECTION_PRIORITY_GROUPS.length;
}

export function compareCollectionsByDisplayOrder(a: Collection, b: Collection): number {
  const rankDiff = collectionDisplayRank(a.handle) - collectionDisplayRank(b.handle);
  if (rankDiff !== 0) return rankDiff;
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

type OrderCollectionsOptions = {
  /** Omit these handles from the result (e.g. home hides “All products”). */
  excludeHandles?: readonly string[];
};

/**
 * Merges virtual “All products” metadata, dedupes by handle, and sorts by
 * {@link COLLECTION_PRIORITY_GROUPS}.
 */
export function orderCollectionsForDisplay(
  collections: Collection[],
  options?: OrderCollectionsOptions,
): Collection[] {
  const exclude = new Set(options?.excludeHandles ?? []);

  const byHandle = new Map<string, Collection>();
  for (const c of collections) {
    if (exclude.has(c.handle)) continue;
    if (c.handle === ALL_PRODUCTS_COLLECTION_HANDLE) {
      continue;
    }
    byHandle.set(c.handle, c);
  }
  if (!exclude.has(ALL_PRODUCTS_COLLECTION_HANDLE)) {
    byHandle.set(ALL_PRODUCTS_COLLECTION_HANDLE, cloneCollection(ALL_PRODUCTS_COLLECTION));
  }

  return dedupeCollectionAliases([...byHandle.values()]).sort(compareCollectionsByDisplayOrder);
}
