import type { QueryClient } from '@tanstack/react-query';

import { APP_HOME_HERO_QUERY_KEY } from '@/constants/app-home-hero-cms';
import { APP_ERROR_QUERY_KEY, isIncidentBannerEnabled } from '@/hooks/use-app-error-banner-content';
import { APP_PROMOTION_BANNER_QUERY_KEY } from '@/lib/app-promotion-banner-query';
import { clearAppContentMemoryCache } from '@/services/kokobay-web/app-content';
import { clearKokobayWebCatalogCache } from '@/services/kokobay-web/catalog';
import { clearKokobayWebCollectionsCache } from '@/services/kokobay-web/collections-catalog';

/** Invalidates cached catalog / search queries and clears Koko Bay web in-memory caches. */
export async function refreshAppData(queryClient: QueryClient): Promise<void> {
  clearKokobayWebCatalogCache();
  clearKokobayWebCollectionsCache();
  await Promise.all([
    ...(isIncidentBannerEnabled() ?
      [queryClient.invalidateQueries({ queryKey: [...APP_ERROR_QUERY_KEY] })]
    : []),
    queryClient.invalidateQueries({ queryKey: [...APP_PROMOTION_BANNER_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: ['home', 'catalog'] }),
    queryClient.invalidateQueries({ queryKey: [...APP_HOME_HERO_QUERY_KEY] }),
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
