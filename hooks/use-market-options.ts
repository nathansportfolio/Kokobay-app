import { useQuery } from '@tanstack/react-query';

import { fetchShopifyMarketOptions } from '@/services/shopify/localization';

export function useMarketOptions() {
  return useQuery({
    queryKey: ['shopify', 'localization', 'markets'],
    queryFn: fetchShopifyMarketOptions,
    staleTime: 24 * 60 * 60_000,
  });
}
