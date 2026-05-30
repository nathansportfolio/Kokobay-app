import { useMemo } from 'react';

import type { Product } from '@/types/shopify';
import type { PlpFilters, PlpSort } from '@/types/plp';
import { applyPlpFilters, applyPlpSort } from '@/utils/plp';

export const COLLECTION_PLP_PAGE_SIZE = 10;

export type CollectionPlpPaginatedResult = {
  rows: Product[];
  totalFiltered: number;
  pageCount: number;
  /** Clamped 0-based page index used for the current slice */
  pageIndex: number;
};

type CollectionPlpPaginatedOptions = {
  skipClientFilters?: boolean;
  /**
   * `paged` — fixed in-memory pages (`COLLECTION_PLP_PAGE_SIZE`) for legacy Storefront loads.
   * `stream` — show every loaded product; network pagination is handled separately (Koko Bay API).
   */
  displayMode?: 'paged' | 'stream';
};

/**
 * In-memory filter, sort, and optional fixed-size pages (no network pagination).
 * `pageIndex` is 0-based; callers should reset to 0 when filters or sort change.
 */
export function useCollectionPlpPaginated(
  allProducts: Product[] | undefined,
  filters: PlpFilters,
  sort: PlpSort,
  pageIndex: number,
  options?: CollectionPlpPaginatedOptions,
): CollectionPlpPaginatedResult | null {
  const skipClientFilters = options?.skipClientFilters ?? false;
  const displayMode = options?.displayMode ?? 'paged';

  return useMemo(() => {
    if (allProducts === undefined) return null;

    const filtered = skipClientFilters ? allProducts : applyPlpFilters(allProducts, filters);
    const sorted = applyPlpSort(filtered, sort);
    const totalFiltered = sorted.length;

    if (totalFiltered === 0) {
      return { rows: [], totalFiltered: 0, pageCount: 0, pageIndex: 0 };
    }

    if (displayMode === 'stream') {
      return { rows: sorted, totalFiltered, pageCount: 1, pageIndex: 0 };
    }

    const pageCount = Math.ceil(totalFiltered / COLLECTION_PLP_PAGE_SIZE);
    const clampedPage = Math.min(Math.max(0, pageIndex), pageCount - 1);
    const start = clampedPage * COLLECTION_PLP_PAGE_SIZE;
    const rows = sorted.slice(start, start + COLLECTION_PLP_PAGE_SIZE);

    return { rows, totalFiltered, pageCount, pageIndex: clampedPage };
  }, [allProducts, filters, sort, pageIndex, skipClientFilters, displayMode]);
}
