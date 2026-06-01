import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import {
  fetchKokobayCollectionPage,
  fetchKokobayLatestProducts,
} from '@/services/kokobay-web/storefront-catalog';
import { getCollectionProducts, getCollections } from '@/services/shopify';
import type { Collection, Product } from '@/types/shopify';
import { LIVE_NEW_IN_COLLECTION_HANDLE } from '@/utils/collection-handles';

/** Same cap as the home “New in” horizontal carousel (`app/(tabs)/index.tsx`). */
export const HOME_NEW_IN_CAROUSEL_LIMIT = 10;

/** Home collections editorial tiles — full list on the Collections tab. */
export const HOME_SHOP_BY_CATEGORY_LIMIT = 3;

async function fetchKokobayHomeNewIn(handle: string, limit: number): Promise<Product[]> {
  const collectionPage = await fetchKokobayCollectionPage(handle, {
    first: limit,
  });
  if (collectionPage?.items.length) {
    return collectionPage.items.slice(0, limit);
  }
  const latest = await fetchKokobayLatestProducts(limit);
  return latest.slice(0, limit);
}

export type FetchHomeCatalogDataOptions = {
  /** From CMS hero `buttonLink` for the active market; defaults to `all-new-in`. */
  newInCollectionHandle?: string;
};

/**
 * Home + search overlay share this so React Query dedupes on `['home', 'catalog', country, handle]`.
 */
export async function fetchHomeCatalogData(
  options: FetchHomeCatalogDataOptions = {},
): Promise<{ collections: Collection[]; newIn: Product[] }> {
  const newInHandle =
    options.newInCollectionHandle?.trim() || LIVE_NEW_IN_COLLECTION_HANDLE;

  if (isKokobayWebProductsConfigured()) {
    const [collections, newIn] = await Promise.all([
      getCollections(),
      fetchKokobayHomeNewIn(newInHandle, HOME_NEW_IN_CAROUSEL_LIMIT),
    ]);
    return { collections, newIn };
  }
  const legacyHandle = newInHandle === LIVE_NEW_IN_COLLECTION_HANDLE ? 'new-in' : newInHandle;
  const [collections, newIn] = await Promise.all([
    getCollections(),
    getCollectionProducts(legacyHandle),
  ]);
  return {
    collections,
    newIn: newIn.slice(0, HOME_NEW_IN_CAROUSEL_LIMIT),
  };
}
