export type PlpSort = 'featured' | 'price-asc' | 'price-desc' | 'newest';

export type PlpFilters = {
  sizes: string[];
  categories: string[];
  /** Selected **colour group** labels (or unmapped raw values) from the filter sheet. */
  colors: string[];
  /**
   * Inclusive lower bound on each product’s minimum variant price.
   * `null` = no floor (from catalogue minimum).
   */
  priceMin: number | null;
  /**
   * Inclusive upper bound on each product’s minimum variant price.
   * `null` = no cap (full range up to catalogue max).
   */
  priceMax: number | null;
};

export const defaultPlpFilters: PlpFilters = {
  sizes: [],
  categories: [],
  colors: [],
  priceMin: null,
  priceMax: null,
};

export const PLP_SORT_OPTIONS: { value: PlpSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price — low to high' },
  { value: 'price-desc', label: 'Price — high to low' },
  { value: 'newest', label: 'Newest first' },
];
