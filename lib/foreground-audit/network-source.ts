export type ForegroundNetworkSource =
  | 'cart'
  | 'wishlist'
  | 'promotions'
  | 'products'
  | 'collections'
  | 'auth'
  | 'search'
  | 'other';

/** Classify a request URL for grouped foreground network totals. */
export function classifyForegroundNetworkSource(url: string): ForegroundNetworkSource {
  const path = url.split('?')[0]?.toLowerCase() ?? url.toLowerCase();

  if (path.includes('/api/cart')) return 'cart';
  if (path.includes('wishlist')) return 'wishlist';
  if (path.includes('promotion') || path.includes('app-promotion')) return 'promotions';
  if (path.includes('/api/search')) return 'search';
  if (path.includes('/api/collections')) return 'collections';
  if (
    path.includes('/api/products') ||
    path.includes('/api/recommendations') ||
    path.includes('storefront') ||
    path.includes('/graphql')
  ) {
    return 'products';
  }
  if (
    path.includes('/api/customer') ||
    path.includes('/api/account') ||
    path.includes('customer') ||
    path.includes('/auth')
  ) {
    return 'auth';
  }

  return 'other';
}
