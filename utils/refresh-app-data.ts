import type { QueryClient } from '@tanstack/react-query';

import { clearAppContentMemoryCache } from '@/services/kokobay-web/app-content';
import { clearKokobayWebCatalogCache } from '@/services/kokobay-web/catalog';
import { clearKokobayWebCollectionsCache } from '@/services/kokobay-web/collections-catalog';

/** Invalidates cached catalog / search queries and clears Koko Bay web in-memory caches. */
export async function refreshAppData(queryClient: QueryClient): Promise<void> {
  clearKokobayWebCatalogCache();
  clearKokobayWebCollectionsCache();
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['app-error'] }),
    queryClient.invalidateQueries({ queryKey: ['app-promotion-banner'] }),
    queryClient.invalidateQueries({ queryKey: ['delivery-threshold'] }),
    queryClient.invalidateQueries({ queryKey: ['home', 'catalog'] }),
    queryClient.invalidateQueries({ queryKey: ['collections-cms'] }),
    queryClient.invalidateQueries({ queryKey: ['categories', 'collections'] }),
    queryClient.invalidateQueries({ queryKey: ['kokobay', 'api', 'collections'] }),
    queryClient.invalidateQueries({ queryKey: ['kokobay', 'collection-products'] }),
    queryClient.invalidateQueries({ queryKey: ['kokobay', 'search-products'] }),
    queryClient.invalidateQueries({ queryKey: ['product-recommendations'] }),
    queryClient.invalidateQueries({ queryKey: ['collection'] }),
    queryClient.invalidateQueries({ queryKey: ['product'] }),
    queryClient.invalidateQueries({ queryKey: ['search'] }),
    queryClient.invalidateQueries({ queryKey: ['catalogSearch'] }),
    queryClient.invalidateQueries({ queryKey: ['search-predictive'] }),
    queryClient.invalidateQueries({ queryKey: ['search-overlay-carousel'] }),
    queryClient.invalidateQueries({ queryKey: ['shopify', 'localization'] }),
  ]);
}
