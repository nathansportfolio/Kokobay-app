import type { Collection, Product } from '@/types/shopify';
import { collectionHasCoverImage } from '@/utils/collection-text';

import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { fetchKokobayPredictiveSearch } from '@/services/kokobay-web/search';
import { getCollections } from '@/services/shopify/collections';
import { searchProducts } from '@/services/shopify/products';

function cloneCollection(c: Collection): Collection {
  return {
    ...c,
    image: c.image ? { ...c.image } : null,
  };
}

function filterCollections(query: string, pool: Collection[], limit = 8): Collection[] {
  const withCovers = pool.filter(collectionHasCoverImage);
  const q = query.trim().toLowerCase();
  if (!q) {
    return withCovers.slice(0, limit).map(cloneCollection);
  }
  return withCovers
    .filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, limit)
    .map(cloneCollection);
}

/** Collection matches from the live catalog API. */
export async function searchCollectionsLocal(query: string, limit = 8): Promise<Collection[]> {
  const collections = await getCollections(48);
  return filterCollections(query, collections, limit);
}

export type CatalogSearchSource = 'shopify';

export type CatalogSearchResult = {
  products: Product[];
  collections: Collection[];
  source: CatalogSearchSource;
};

/**
 * Predictive catalog search: product search via Koko Bay or Storefront APIs;
 * collection suggestions from the live collections list.
 */
export async function searchCatalog(query: string, first = 20): Promise<CatalogSearchResult> {
  const safe = query.trim();
  const collections = await searchCollectionsLocal(safe, 8);

  if (!safe) {
    return { products: [], collections, source: 'shopify' };
  }

  if (isKokobayWebProductsConfigured() && safe.length >= 2) {
    const predictive = await fetchKokobayPredictiveSearch(safe, Math.min(first, 24));
    if (predictive) {
      return {
        products: predictive.products,
        collections: predictive.collections.length ? predictive.collections : collections,
        source: 'shopify',
      };
    }
  }

  const products = await searchProducts(safe, first);

  return { products, collections, source: 'shopify' };
}
