import { useQuery } from '@tanstack/react-query';

import {
  APP_CART_DELIVERY_TEXT_QUERY_KEY,
  DEFAULT_CART_DELIVERY_AT_CHECKOUT_LABEL,
} from '@/constants/app-cart-delivery-text-cms';
import {
  fetchAppCartDeliveryText,
  type AppCartDeliveryTextPayload,
} from '@/services/kokobay-web/app-cart-delivery-text';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';

const CART_DELIVERY_TEXT_STALE_MS = 30 * 60_000;

/** Shared React Query fetch for `GET /api/content/app-cart-delivery-text-{country}`. */
export function useAppCartDeliveryTextQuery() {
  const marketKey = useMarketQueryKey();
  const enabled = isKokobayWebProductsConfigured();

  return useQuery<AppCartDeliveryTextPayload | null>({
    queryKey: [...APP_CART_DELIVERY_TEXT_QUERY_KEY, marketKey],
    enabled,
    staleTime: CART_DELIVERY_TEXT_STALE_MS,
    gcTime: 60 * 60_000,
    queryFn: ({ signal }) => fetchAppCartDeliveryText(marketKey, { signal }),
  });
}

/** Delivery row label when shipping is calculated at checkout (CMS with built-in fallback). */
export function useAppCartDeliveryTextLabel(): string {
  const query = useAppCartDeliveryTextQuery();
  const text = query.data?.text?.trim();
  return text || DEFAULT_CART_DELIVERY_AT_CHECKOUT_LABEL;
}
