/**
 * Server-state query keys — React Query only.
 * Local state (auth, cart, market, preferences) lives in Zustand; never duplicate here.
 */

export const accountQueryKeys = {
  root: ['account'] as const,
  orders: (customerId: string) => ['account', 'orders', customerId] as const,
  appBenefits: (userId: string) => ['account', 'app-benefits', userId] as const,
} as const;

export const cmsQueryKeys = {
  root: ['app-content'] as const,
  content: (slug: string, country: string) => ['app-content', slug, country] as const,
} as const;

export const collectionsQueryKeys = {
  cms: ['collections-cms'] as const,
  catalog: ['kokobay', 'api', 'collections'] as const,
  shopifyFallback: ['categories', 'collections'] as const,
} as const;

export const productQueryKeys = {
  root: ['product'] as const,
  detail: (handle: string, marketKey: string) => ['product', handle, marketKey] as const,
  recommendations: (handle: string, kind: string, marketKey: string) =>
    ['product-recommendations', handle, kind, marketKey] as const,
} as const;

export const catalogQueryKeys = {
  kokobayCollectionProducts: ['kokobay', 'collection-products'] as const,
  kokobaySearchProducts: ['kokobay', 'search-products'] as const,
  homeCatalog: ['home', 'catalog'] as const,
} as const;

export const deliveryThresholdQueryKey = ['delivery-threshold'] as const;

export const searchQueryKeys = {
  predictive: ['search-predictive'] as const,
  overlayCarousel: ['search-overlay-carousel'] as const,
  catalogSearch: ['catalogSearch'] as const,
  plp: ['search', 'plp'] as const,
} as const;
