/** React Query key prefix for full product fetches (`utils/product-query-key`). */
export const PRODUCT_QUERY_KEY_PREFIX = ['product'] as const;

export const PRODUCT_RECOMMENDATIONS_QUERY_KEY_PREFIX = ['product-recommendations'] as const;

/** PDP / prefetch — fresh enough for a session, shorter than global 45 min GC. */
export const PRODUCT_QUERY_STALE_TIME_MS = 6 * 60_000;

export const PRODUCT_QUERY_GC_TIME_MS = 10 * 60_000;
