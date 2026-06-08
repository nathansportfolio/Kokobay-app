import type { KokobayStorefrontFilter } from '@/services/kokobay-web/storefront-types';
import type { PlpFilters, PlpSort } from '@/types/plp';
import {
  colourGroupLabelsFromRawValues,
  estimateColourGroupUnionCount,
  expandColourFilterSelection,
  groupsForRawColourValue,
  normColourLabel,
} from '@/utils/colour-groups';
import { sortCategoryLabels } from '@/utils/category-sort';
import { sortSizeLabels } from '@/utils/size-sort';
import {
  isPriceFilterActive,
  PLP_PRICE_FILTER_SLIDER_MAX,
  PLP_PRICE_FILTER_SLIDER_META,
  PLP_PRICE_FILTER_SLIDER_MIN,
  PLP_PRICE_SLIDER_EPS,
} from '@/utils/plp';

export type PlpFacetCounts = Record<string, number>;

/** Hide facet chips with no matching products; keep selected values visible so they can be cleared. */
export function visibleFacetOptions(
  options: string[],
  counts: PlpFacetCounts | undefined,
  selected: string[] = [],
): string[] {
  return options.filter((option) => {
    if (selected.includes(option)) return true;
    if (!counts) return true;
    const count = counts[option];
    return count != null && count > 0;
  });
}

export type StorefrontFilterFacets = {
  sizes: string[];
  categories: string[];
  colourGroups: string[];
  sizeCounts: PlpFacetCounts;
  categoryCounts: PlpFacetCounts;
  colourGroupCounts: PlpFacetCounts;
  priceMin: number;
  priceMax: number;
};

export type StorefrontFilterLookup = {
  sizeByLabel: Map<string, string>;
  categoryByLabel: Map<string, string>;
  colorByLabel: Map<string, string>;
};

function normalizeStorefrontFilters(raw: unknown): KokobayStorefrontFilter[] {
  if (!Array.isArray(raw)) return [];
  const out: KokobayStorefrontFilter[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const id = (f as { id?: string }).id;
    const label = (f as { label?: string }).label;
    const type = (f as { type?: string }).type;
    if (!id || !label || !type) continue;
    const valuesRaw = (f as { values?: unknown }).values;
    const values: KokobayStorefrontFilter['values'] = [];
    if (Array.isArray(valuesRaw)) {
      for (const v of valuesRaw) {
        if (!v || typeof v !== 'object') continue;
        const vid = (v as { id?: string }).id;
        const vlabel = (v as { label?: string }).label;
        const count = (v as { count?: number }).count;
        const input = (v as { input?: string }).input;
        if (!vid || !vlabel || typeof count !== 'number' || !input) continue;
        values.push({ id: vid, label: vlabel, count, input });
      }
    }
    out.push({ id, label, type, values });
  }
  return out;
}

export function parseStorefrontFilters(raw: unknown): KokobayStorefrontFilter[] {
  return normalizeStorefrontFilters(raw);
}

function filterBucket(
  filter: KokobayStorefrontFilter,
): 'size' | 'category' | 'color' | 'price' | null {
  if (filter.type === 'PRICE_RANGE') return 'price';
  const id = filter.id.toLowerCase();
  const label = filter.label.toLowerCase();
  if (id.includes('size') || label === 'size') return 'size';
  if (id.includes('category') || label === 'category') return 'category';
  if (id.includes('color') || id.includes('colour') || label === 'color' || label === 'colour') {
    return 'color';
  }
  return null;
}

export function createStorefrontFilterLookup(
  filters: KokobayStorefrontFilter[],
): StorefrontFilterLookup {
  const sizeByLabel = new Map<string, string>();
  const categoryByLabel = new Map<string, string>();
  const colorByLabel = new Map<string, string>();

  for (const f of filters) {
    const bucket = filterBucket(f);
    if (!bucket || bucket === 'price') continue;
    const target =
      bucket === 'size' ? sizeByLabel : bucket === 'category' ? categoryByLabel : colorByLabel;
    for (const v of f.values) {
      target.set(v.label, v.input);
    }
  }

  return { sizeByLabel, categoryByLabel, colorByLabel };
}

function isShopifyFilterSettingGroupInput(input: string): boolean {
  try {
    const parsed = JSON.parse(input) as { variantOption?: { value?: string } };
    const value = parsed.variantOption?.value ?? '';
    return value.includes('FilterSettingGroup') || value.startsWith('gid://');
  } catch {
    return false;
  }
}

function normalizeFilterInputDedupeKey(input: string): string {
  try {
    const parsed = JSON.parse(input) as { variantOption?: { name?: string; value?: string } };
    if (parsed.variantOption) {
      return JSON.stringify({
        name: normColourLabel(parsed.variantOption.name ?? ''),
        value: normColourLabel(parsed.variantOption.value ?? ''),
      });
    }
  } catch {
    /* ignore malformed filter JSON */
  }
  return input.trim();
}

/** One Shopify filter input per selected editorial colour group (prefer S&D group filters). */
export function resolveColourFilterInputsForSelection(
  selectedGroups: string[],
  lookup: StorefrontFilterLookup,
): string[] {
  const inputs: string[] = [];
  const seen = new Set<string>();

  for (const group of selectedGroups) {
    const expanded = expandColourFilterSelection([group]);
    const matches: { label: string; input: string }[] = [];
    for (const [label, input] of lookup.colorByLabel) {
      if (expanded.has(normColourLabel(label))) {
        matches.push({ label, input });
      }
    }
    if (!matches.length) continue;

    const groupNamed = matches.find((m) => normColourLabel(m.label) === normColourLabel(group));
    const groupSetting = matches.find((m) => isShopifyFilterSettingGroupInput(m.input));
    const toAppend = groupNamed ? [groupNamed] : groupSetting ? [groupSetting] : matches;

    for (const { input } of toAppend) {
      const key = normalizeFilterInputDedupeKey(input);
      if (seen.has(key)) continue;
      seen.add(key);
      inputs.push(input);
    }
  }

  return inputs;
}

export function facetsFromStorefrontFilters(filters: KokobayStorefrontFilter[]): StorefrontFilterFacets {
  let priceMin = 0;
  let priceMax = 0;
  const sizes: string[] = [];
  const sizeSeen = new Set<string>();
  const sizeCounts: PlpFacetCounts = {};
  const categories = new Set<string>();
  const categoryCounts: PlpFacetCounts = {};
  const colors = new Set<string>();
  const groupsWithNamedFacet = new Set<string>();
  const colourGroupMemberCounts = new Map<string, number[]>();

  for (const f of filters) {
    const bucket = filterBucket(f);
    if (bucket !== 'color') continue;
    for (const v of f.values) {
      if (v.count <= 0) continue;
      for (const group of groupsForRawColourValue(v.label)) {
        if (normColourLabel(v.label) === normColourLabel(group)) {
          groupsWithNamedFacet.add(group);
        }
      }
    }
  }

  for (const f of filters) {
    const bucket = filterBucket(f);
    if (bucket === 'price') {
      for (const v of f.values) {
        try {
          const parsed = JSON.parse(v.input) as { price?: { min?: number; max?: number } };
          if (parsed.price) {
            priceMin = parsed.price.min ?? 0;
            priceMax = parsed.price.max ?? 0;
          }
        } catch {
          /* ignore malformed price filter input */
        }
      }
      continue;
    }
    if (!bucket) continue;
    for (const v of f.values) {
      if (v.count <= 0) continue;
      if (bucket === 'size') {
        if (!sizeSeen.has(v.label)) {
          sizeSeen.add(v.label);
          sizes.push(v.label);
        }
        sizeCounts[v.label] = v.count;
      } else if (bucket === 'category') {
        categories.add(v.label);
        categoryCounts[v.label] = v.count;
      } else {
        colors.add(v.label);
        for (const group of groupsForRawColourValue(v.label)) {
          if (groupsWithNamedFacet.has(group)) continue;
          const memberCounts = colourGroupMemberCounts.get(group) ?? [];
          memberCounts.push(v.count);
          colourGroupMemberCounts.set(group, memberCounts);
        }
      }
    }
  }

  const colourGroupCounts: PlpFacetCounts = {};
  for (const f of filters) {
    if (filterBucket(f) !== 'color') continue;
    for (const v of f.values) {
      if (v.count <= 0) continue;
      for (const group of groupsForRawColourValue(v.label)) {
        if (
          groupsWithNamedFacet.has(group) &&
          normColourLabel(v.label) === normColourLabel(group)
        ) {
          colourGroupCounts[group] = v.count;
        }
      }
    }
  }
  for (const [group, memberCounts] of colourGroupMemberCounts) {
    if (colourGroupCounts[group] != null) continue;
    colourGroupCounts[group] = estimateColourGroupUnionCount(memberCounts);
  }

  return {
    sizes: sortSizeLabels(sizes),
    categories: sortCategoryLabels([...categories]),
    colourGroups: colourGroupLabelsFromRawValues(colors, colourGroupCounts),
    sizeCounts,
    categoryCounts,
    colourGroupCounts,
    priceMin,
    priceMax,
  };
}

export function plpSortToCollectionSortParam(sort: PlpSort): string {
  switch (sort) {
    case 'price-asc':
      return 'price_asc';
    case 'price-desc':
      return 'price_desc';
    case 'newest':
      return 'created';
    default:
      return 'featured';
  }
}

export function plpSortToSearchSortParam(sort: PlpSort): string {
  switch (sort) {
    case 'price-asc':
      return 'price_asc';
    case 'price-desc':
      return 'price_desc';
    case 'newest':
      return 'created';
    default:
      return 'relevance';
  }
}

export function appendPlpFiltersToSearchParams(
  params: URLSearchParams,
  plpFilters: PlpFilters,
  storefrontFilters: KokobayStorefrontFilter[],
): void {
  const lookup = createStorefrontFilterLookup(storefrontFilters);

  for (const size of plpFilters.sizes) {
    const input = lookup.sizeByLabel.get(size);
    if (input) params.append('filter', input);
    else params.append('size', size);
  }

  for (const category of plpFilters.categories) {
    const input = lookup.categoryByLabel.get(category);
    if (input) params.append('filter', input);
  }

  for (const input of resolveColourFilterInputsForSelection(plpFilters.colors, lookup)) {
    params.append('filter', input);
  }

  if (__DEV__ && plpFilters.colors.length > 0) {
    console.info('[plp-filters]', {
      selectedColorGroups: plpFilters.colors,
      chosenFilterInputs: resolveColourFilterInputsForSelection(plpFilters.colors, lookup),
      filterParams: params.getAll('filter'),
    });
  }

  if (plpFilters.priceMin != null && Number.isFinite(plpFilters.priceMin)) {
    params.set('minPrice', String(plpFilters.priceMin));
  }
  if (plpFilters.priceMax != null && Number.isFinite(plpFilters.priceMax)) {
    params.set('maxPrice', String(plpFilters.priceMax));
  }
}

export function hasActivePlpFilters(
  plpFilters: PlpFilters,
  catalogMinPrice: number,
  catalogMaxPrice: number,
): boolean {
  return (
    plpFilters.sizes.length > 0 ||
    plpFilters.categories.length > 0 ||
    plpFilters.colors.length > 0 ||
    isPriceFilterActive(plpFilters, catalogMinPrice, catalogMaxPrice)
  );
}

/** True when Shopify filter inputs can be mapped from a prior collection/search response. */
export function canApplyStorefrontPlpFilters(
  storefrontFilters: KokobayStorefrontFilter[],
): boolean {
  return storefrontFilters.length > 0;
}

/** Price slider bounds for PLP filters — fixed £0–£120 (not derived from catalog). */
export function storefrontFilterPriceMeta(
  _facets: StorefrontFilterFacets,
  _productMin: number,
  _productMax: number,
  currencyCode?: string,
): { min: number; max: number; currencyCode: string } {
  return {
    min: PLP_PRICE_FILTER_SLIDER_MIN,
    max: PLP_PRICE_FILTER_SLIDER_MAX,
    currencyCode: currencyCode?.trim() || PLP_PRICE_FILTER_SLIDER_META.currencyCode,
  };
}
