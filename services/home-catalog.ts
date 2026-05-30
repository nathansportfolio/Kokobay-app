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

async function fetchKokobayHomeNewIn(limit: number): Promise<Product[]> {
  const collectionPage = await fetchKokobayCollectionPage(LIVE_NEW_IN_COLLECTION_HANDLE, {
    first: limit,
  });
  if (collectionPage?.items.length) {
    return collectionPage.items.slice(0, limit);
  }
  const latest = await fetchKokobayLatestProducts(limit);
  return latest.slice(0, limit);
}

/**
 * Home + search overlay share this so React Query dedupes on `['home', 'catalog']`.
 */
export async function fetchHomeCatalogData(): Promise<{ collections: Collection[]; newIn: Product[] }> {
  if (isKokobayWebProductsConfigured()) {
    const [collections, newIn] = await Promise.all([
      getCollections(),
      fetchKokobayHomeNewIn(HOME_NEW_IN_CAROUSEL_LIMIT),
    ]);
    return { collections, newIn };
  }
  const [collections, newIn] = await Promise.all([getCollections(), getCollectionProducts('new-in')]);
  return {
    collections,
    newIn: newIn.slice(0, HOME_NEW_IN_CAROUSEL_LIMIT),
  };
}
