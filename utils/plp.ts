import type { Product } from '@/types/shopify';

import type { PlpFilters, PlpSort } from '@/types/plp';
import {
  colourGroupLabelsFromRawValues,
  expandColourFilterSelection,
  groupsForRawColourValue,
  normColourLabel,
} from '@/utils/colour-groups';
import type { PlpFacetCounts } from '@/utils/storefront-filters';
import { sortCategoryLabels } from '@/utils/category-sort';
import { sortSizeLabels } from '@/utils/size-sort';

/** Treat slider “at the top” as no price filter (avoids float edge cases). */
export const PLP_PRICE_SLIDER_EPS = 0.01;

/** Fixed PLP price filter rail — does not track loaded product min/max. */
export const PLP_PRICE_FILTER_SLIDER_MIN = 0;
export const PLP_PRICE_FILTER_SLIDER_MAX = 120;

export const PLP_PRICE_FILTER_SLIDER_META = {
  min: PLP_PRICE_FILTER_SLIDER_MIN,
  max: PLP_PRICE_FILTER_SLIDER_MAX,
  currencyCode: 'GBP',
} as const;

export function plpPriceSliderMetaForCurrency(currencyCode: string) {
  return {
    min: PLP_PRICE_FILTER_SLIDER_MIN,
    max: PLP_PRICE_FILTER_SLIDER_MAX,
    currencyCode: currencyCode.trim() || PLP_PRICE_FILTER_SLIDER_META.currencyCode,
  };
}

export function productMinPrice(p: Product): number {
  return Number.parseFloat(p.priceRange.minVariantPrice.amount);
}

/** Lowest / highest min-variant price in the slice + currency for the sliders / labels. */
export function catalogPriceSliderMeta(products: Product[]): {
  min: number;
  max: number;
  currencyCode: string;
} {
  if (!products.length) {
    return { min: 0, max: 0, currencyCode: 'GBP' };
  }
  let max = 0;
  let min = Number.POSITIVE_INFINITY;
  for (const p of products) {
    const n = productMinPrice(p);
    if (Number.isFinite(n)) {
      if (n > max) max = n;
      if (n < min) min = n;
    }
  }
  if (!Number.isFinite(min)) min = 0;
  return { min, max, currencyCode: products[0]!.priceRange.minVariantPrice.currencyCode };
}

export function plpPriceSliderStep(catalogMax: number): number {
  if (catalogMax <= 0) return 1;
  if (catalogMax < 50) return 1;
  if (catalogMax <= 150) return 5;
  if (catalogMax <= 500) return 10;
  if (catalogMax <= 2000) return 25;
  return Math.max(50, Math.round(catalogMax / 40));
}

export function isPriceFilterActive(
  f: PlpFilters,
  catalogMinPrice: number,
  catalogMaxPrice: number,
): boolean {
  if (catalogMaxPrice <= catalogMinPrice + PLP_PRICE_SLIDER_EPS) return false;
  const minActive =
    f.priceMin != null &&
    Number.isFinite(f.priceMin) &&
    f.priceMin > catalogMinPrice + PLP_PRICE_SLIDER_EPS;
  const maxActive =
    f.priceMax != null &&
    Number.isFinite(f.priceMax) &&
    f.priceMax < catalogMaxPrice - PLP_PRICE_SLIDER_EPS;
  return minActive || maxActive;
}

export function normalizePlpPriceMin(
  priceMin: number | null,
  catalogMin: number,
  catalogMax: number,
): number | null {
  if (priceMin == null || !Number.isFinite(priceMin) || catalogMax <= catalogMin + PLP_PRICE_SLIDER_EPS) {
    return null;
  }
  const capped = Math.min(Math.max(priceMin, catalogMin), catalogMax);
  if (capped <= catalogMin + PLP_PRICE_SLIDER_EPS) return null;
  return capped;
}

export function normalizePlpPriceMax(
  priceMax: number | null,
  catalogMin: number,
  catalogMax: number,
): number | null {
  if (priceMax == null || !Number.isFinite(priceMax) || catalogMax <= catalogMin + PLP_PRICE_SLIDER_EPS) {
    return null;
  }
  const capped = Math.min(Math.max(priceMax, catalogMin), catalogMax);
  if (capped >= catalogMax - PLP_PRICE_SLIDER_EPS) return null;
  return capped;
}

/** Coerce stored bounds to the catalogue range and keep min ≤ max. */
export function normalizePlpPriceRangeForDraft(
  priceMin: number | null,
  priceMax: number | null,
  catalogMin: number,
  catalogMax: number,
): { priceMin: number | null; priceMax: number | null } {
  let pmin = normalizePlpPriceMin(priceMin, catalogMin, catalogMax);
  let pmax = normalizePlpPriceMax(priceMax, catalogMin, catalogMax);
  if (pmin != null && pmax != null && pmin > pmax + PLP_PRICE_SLIDER_EPS) {
    pmax = pmin;
  }
  return { priceMin: pmin, priceMax: pmax };
}

export function countActivePlpFilters(
  f: PlpFilters,
  catalogMinPrice: number,
  catalogMaxPrice: number,
): number {
  return (
    f.sizes.length +
    f.categories.length +
    f.colors.length +
    (isPriceFilterActive(f, catalogMinPrice, catalogMaxPrice) ? 1 : 0)
  );
}

export function formatPlpProductCount(count: number): string {
  return count === 1 ? '1 product' : `${count} products`;
}

export type PlpActiveFilterChip =
  | { kind: 'size'; value: string; label: string }
  | { kind: 'category'; value: string; label: string }
  | { kind: 'color'; value: string; label: string };

export function listActivePlpFilterChips(draft: PlpFilters): PlpActiveFilterChip[] {
  const chips: PlpActiveFilterChip[] = [];
  for (const size of draft.sizes) {
    chips.push({ kind: 'size', value: size, label: size });
  }
  for (const category of draft.categories) {
    chips.push({ kind: 'category', value: category, label: category });
  }
  for (const color of draft.colors) {
    chips.push({ kind: 'color', value: color, label: color });
  }
  return chips;
}

export function removePlpFilterChip(draft: PlpFilters, chip: PlpActiveFilterChip): PlpFilters {
  switch (chip.kind) {
    case 'size':
      return { ...draft, sizes: draft.sizes.filter((value) => value !== chip.value) };
    case 'category':
      return { ...draft, categories: draft.categories.filter((value) => value !== chip.value) };
    case 'color':
      return { ...draft, colors: draft.colors.filter((value) => value !== chip.value) };
  }
}

export function getVariantFacetValues(p: Product, facetName: 'Size'): string[] {
  const out = new Set<string>();
  for (const v of p.variants) {
    for (const o of v.selectedOptions) {
      if (o.name.toLowerCase() === facetName.toLowerCase()) {
        out.add(o.value);
      }
    }
  }
  return [...out];
}

/** Variant colour option values (supports `Color` or `Colour` option names). */
export function getVariantColourValues(p: Product): string[] {
  const out = new Set<string>();
  for (const v of p.variants) {
    for (const o of v.selectedOptions) {
      const n = o.name.trim().toLowerCase();
      if (n === 'color' || n === 'colour') {
        const val = o.value?.trim();
        if (val) out.add(val);
      }
    }
  }
  return [...out];
}

export function extractFacets(products: Product[]) {
  const sizes = new Set<string>();
  const colors = new Set<string>();
  const categories = new Set<string>();
  const sizeCounts: PlpFacetCounts = {};
  const categoryCounts: PlpFacetCounts = {};
  const colourGroupCounts: PlpFacetCounts = {};

  for (const p of products) {
    const category = p.productType || 'Other';
    categories.add(category);
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;

    const productSizes = getVariantFacetValues(p, 'Size');
    for (const size of productSizes) {
      sizes.add(size);
      sizeCounts[size] = (sizeCounts[size] ?? 0) + 1;
    }

    const colourGroupsForProduct = new Set<string>();
    for (const colour of getVariantColourValues(p)) {
      colors.add(colour);
      for (const group of groupsForRawColourValue(colour)) {
        colourGroupsForProduct.add(group);
      }
    }
    for (const group of colourGroupsForProduct) {
      colourGroupCounts[group] = (colourGroupCounts[group] ?? 0) + 1;
    }
  }

  return {
    sizes: sortSizeLabels([...sizes]),
    colourGroups: colourGroupLabelsFromRawValues(colors, colourGroupCounts),
    categories: sortCategoryLabels([...categories]),
    sizeCounts,
    categoryCounts,
    colourGroupCounts,
  };
}

export function applyPlpFilters(products: Product[], f: PlpFilters): Product[] {
  return products.filter((p) => {
    if (f.sizes.length) {
      const sizes = getVariantFacetValues(p, 'Size');
      if (!sizes.some((s) => f.sizes.includes(s))) return false;
    }
    if (f.categories.length) {
      const cat = p.productType || 'Other';
      if (!f.categories.includes(cat)) return false;
    }
    if (f.colors.length) {
      const want = expandColourFilterSelection(f.colors);
      const colours = getVariantColourValues(p);
      if (!colours.some((c) => want.has(normColourLabel(c)))) return false;
    }
    const price = productMinPrice(p);
    if (f.priceMin != null && Number.isFinite(f.priceMin) && price < f.priceMin - PLP_PRICE_SLIDER_EPS) {
      return false;
    }
    if (f.priceMax != null && Number.isFinite(f.priceMax) && price > f.priceMax + PLP_PRICE_SLIDER_EPS) {
      return false;
    }
    return true;
  });
}

export function applyPlpSort(products: Product[], sort: PlpSort): Product[] {
  const copy = [...products];
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => productMinPrice(a) - productMinPrice(b));
    case 'price-desc':
      return copy.sort((a, b) => productMinPrice(b) - productMinPrice(a));
    case 'title-asc':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return copy;
  }
}
