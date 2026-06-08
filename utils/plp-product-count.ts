import type { PlpFilters } from '@/types/plp';
import { isPriceFilterActive } from '@/utils/plp';
import type { StorefrontFilterFacets } from '@/utils/storefront-filters';

type ResolvePlpProductCountOptions = {
  hasSelectedFilters: boolean;
  isWebCatalog: boolean;
  totalProductCount: number | undefined;
  totalFiltered: number;
  hasNextPage: boolean;
  filters: PlpFilters;
  facets: StorefrontFilterFacets;
  priceMeta: { min: number; max: number };
};

function countActiveFilterDimensions(
  filters: PlpFilters,
  catalogMinPrice: number,
  catalogMaxPrice: number,
): number {
  let dimensions = 0;
  if (filters.sizes.length > 0) dimensions++;
  if (filters.categories.length > 0) dimensions++;
  if (filters.colors.length > 0) dimensions++;
  if (isPriceFilterActive(filters, catalogMinPrice, catalogMaxPrice)) dimensions++;
  return dimensions;
}

/**
 * Single-dimension facet counts only — e.g. "Dresses (41)".
 * Not valid for AND combinations across category + colour (Shopify counts are per-dimension).
 */
export function estimatePlpFilteredCountFromFacets(
  filters: PlpFilters,
  facets: StorefrontFilterFacets,
): number | null {
  const selectedCounts: number[] = [];

  for (const size of filters.sizes) {
    const count = facets.sizeCounts[size];
    if (count != null && count > 0) selectedCounts.push(count);
  }
  for (const category of filters.categories) {
    const count = facets.categoryCounts[category];
    if (count != null && count > 0) selectedCounts.push(count);
  }
  for (const color of filters.colors) {
    const count = facets.colourGroupCounts[color];
    if (count != null && count > 0) selectedCounts.push(count);
  }

  if (selectedCounts.length === 0) {
    return null;
  }

  return Math.min(...selectedCounts);
}

/** Header + filter-sheet product count. */
export function resolvePlpProductCount({
  hasSelectedFilters,
  isWebCatalog,
  totalProductCount,
  totalFiltered,
  hasNextPage,
  filters,
  facets,
  priceMeta,
}: ResolvePlpProductCountOptions): number {
  if (!hasSelectedFilters) {
    if (isWebCatalog && totalProductCount != null) return totalProductCount;
    return totalFiltered;
  }

  // All matches are loaded — grid length is exact (e.g. category + colour → 1 product).
  if (!hasNextPage) {
    return totalFiltered;
  }

  if (isWebCatalog && totalProductCount != null) {
    return totalProductCount;
  }

  const activeDimensions = countActiveFilterDimensions(filters, priceMeta.min, priceMeta.max);
  if (activeDimensions === 1) {
    const facetEstimate = estimatePlpFilteredCountFromFacets(filters, facets);
    if (facetEstimate != null) return facetEstimate;
  }

  return totalFiltered;
}
