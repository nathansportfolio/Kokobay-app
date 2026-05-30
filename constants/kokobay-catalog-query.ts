/** Kokobay PLP infinite-query retention — see `use-kokobay-catalog-pages`. */
export const KOKOBAY_CATALOG_MAX_PAGES = 10;

/** Garbage-collect inactive catalog queries after 10 minutes (global default is 45). */
export const KOKOBAY_CATALOG_GC_TIME_MS = 10 * 60_000;

export const KOKOBAY_COLLECTION_PRODUCTS_QUERY_KEY = ['kokobay', 'collection-products'] as const;

export const KOKOBAY_SEARCH_PRODUCTS_QUERY_KEY = ['kokobay', 'search-products'] as const;

/** Max products held in one infinite query after trimming (10 × page size 24). */
export const KOKOBAY_CATALOG_MAX_RETAINED_PRODUCTS =
  KOKOBAY_CATALOG_MAX_PAGES * 24;
