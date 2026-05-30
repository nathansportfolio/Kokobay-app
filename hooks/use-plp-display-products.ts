import { useMemo } from 'react';

import type { PlpFilters, PlpSort } from '@/types/plp';
import type { Product } from '@/types/shopify';
import { applyPlpFilters, applyPlpSort } from '@/utils/plp';

type Options = {
  /** When true, filters are applied server-side — only sort client-side if needed. */
  skipClientFilters?: boolean;
};

/**
 * Stream every loaded product for PLP grids (no client page slicing).
 */
export function usePlpDisplayProducts(
  allProducts: Product[] | undefined,
  filters: PlpFilters,
  sort: PlpSort,
  options?: Options,
): { rows: Product[]; totalFiltered: number } {
  const skipClientFilters = options?.skipClientFilters ?? false;

  return useMemo(() => {
    if (allProducts === undefined) {
      return { rows: [], totalFiltered: 0 };
    }

    const filtered = skipClientFilters ? allProducts : applyPlpFilters(allProducts, filters);
    const sorted = applyPlpSort(filtered, sort);
    return { rows: sorted, totalFiltered: sorted.length };
  }, [allProducts, filters, sort, skipClientFilters]);
}
