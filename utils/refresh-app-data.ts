import type { QueryClient } from '@tanstack/react-query';

import { APP_CART_DELIVERY_TEXT_QUERY_KEY } from '@/constants/app-cart-delivery-text-cms';
import { APP_HOME_HERO_QUERY_KEY } from '@/constants/app-home-hero-cms';
import { APP_ERROR_QUERY_KEY, isIncidentBannerEnabled } from '@/hooks/use-app-error-banner-content';
import { APP_PROMOTION_BANNER_QUERY_KEY } from '@/lib/app-promotion-banner-query';
import {
  catalogQueryKeys,
  cmsQueryKeys,
  collectionsQueryKeys,
  deliveryThresholdQueryKey,
  productQueryKeys,
  searchQueryKeys,
} from '@/src/core/query/query-keys';
import { clearKokobayWebCatalogCache } from '@/services/kokobay-web/catalog';

/** Invalidates cached server-state queries on market change or global pull-to-refresh. */
export async function refreshAppData(queryClient: QueryClient): Promise<void> {
  clearKokobayWebCatalogCache();

  await Promise.all([
    ...(isIncidentBannerEnabled() ?
      [queryClient.invalidateQueries({ queryKey: [...APP_ERROR_QUERY_KEY] })]
    : []),
    queryClient.invalidateQueries({ queryKey: [...APP_PROMOTION_BANNER_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [...catalogQueryKeys.homeCatalog] }),
    queryClient.invalidateQueries({ queryKey: [...APP_HOME_HERO_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [...APP_CART_DELIVERY_TEXT_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [...collectionsQueryKeys.cms] }),
    queryClient.invalidateQueries({ queryKey: [...collectionsQueryKeys.shopifyFallback] }),
    queryClient.invalidateQueries({ queryKey: [...collectionsQueryKeys.catalog] }),
    queryClient.invalidateQueries({ queryKey: [...catalogQueryKeys.kokobayCollectionProducts] }),
    queryClient.invalidateQueries({ queryKey: [...catalogQueryKeys.kokobaySearchProducts] }),
    queryClient.invalidateQueries({ queryKey: [...productQueryKeys.root] }),
    queryClient.invalidateQueries({ queryKey: ['product-recommendations'] }),
    queryClient.invalidateQueries({ queryKey: ['collection'] }),
    queryClient.invalidateQueries({ queryKey: [...searchQueryKeys.plp] }),
    queryClient.invalidateQueries({ queryKey: [...searchQueryKeys.catalogSearch] }),
    queryClient.invalidateQueries({ queryKey: [...searchQueryKeys.predictive] }),
    queryClient.invalidateQueries({ queryKey: [...searchQueryKeys.overlayCarousel] }),
    queryClient.invalidateQueries({ queryKey: ['shopify', 'localization'] }),
    queryClient.invalidateQueries({ queryKey: [...cmsQueryKeys.root] }),
    queryClient.invalidateQueries({ queryKey: [...deliveryThresholdQueryKey] }),
  ]);
}
