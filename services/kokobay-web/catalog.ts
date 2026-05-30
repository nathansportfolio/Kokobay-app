import type { Product } from '@/types/shopify';

import { isKokobayWebProductsConfigured } from './client';
import {
  fetchKokobayProductsPage,
  fetchKokobayProductsUpTo,
} from './storefront-catalog';

/**
 * @deprecated Do not load the full catalog. Use paginated `fetchKokobayProductsPage` or collection/search routes.
 * Kept only for legacy call sites during migration — caps at `maxItems` via cursor pagination.
 */
export async function getKokobayWebCatalog(maxItems = 48): Promise<Product[] | null> {
  if (!isKokobayWebProductsConfigured()) return null;
  const items = await fetchKokobayProductsUpTo(maxItems, (after) =>
    fetchKokobayProductsPage({ after }),
  );
  return items;
}

/** @deprecated Bulk `?all=1` removed — clears any in-memory catalog cache (no-op). */
export function clearKokobayWebCatalogCache(): void {
  /* no in-memory bulk cache */
}
