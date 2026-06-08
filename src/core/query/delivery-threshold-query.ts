import { DEFAULT_FREE_DELIVERY_THRESHOLD_GBP } from '@/constants/delivery-threshold';
import { getQueryClient } from '@/hooks/use-query-client';
import { fetchDeliveryThresholdFromApi } from '@/services/kokobay-web/delivery-threshold-api';

import { deliveryThresholdQueryKey } from './query-keys';

export const DELIVERY_THRESHOLD_STALE_MS = 30 * 60_000;

export type DeliveryThresholdLoadSource = 'startup' | 'market_change' | 'cache_expired';

function logDeliveryThreshold(
  source: DeliveryThresholdLoadSource,
  threshold: number,
): void {
  console.log('[DELIVERY THRESHOLD]', { source, threshold });
}

async function fetchDeliveryThresholdValue(): Promise<number> {
  try {
    const value = await fetchDeliveryThresholdFromApi();
    return value ?? DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;
  } catch {
    return DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;
  }
}

/** React Query fetch for `GET /api/delivery-threshold`. */
export async function fetchDeliveryThresholdQuery(
  source: DeliveryThresholdLoadSource,
  options?: { force?: boolean },
): Promise<number> {
  const queryClient = getQueryClient();

  const threshold = await queryClient.fetchQuery({
    queryKey: deliveryThresholdQueryKey,
    staleTime: DELIVERY_THRESHOLD_STALE_MS,
    ...(options?.force ? { staleTime: 0 } : {}),
    queryFn: fetchDeliveryThresholdValue,
  });

  logDeliveryThreshold(source, threshold);
  return threshold;
}

/** Latest known threshold from React Query cache (last fetch or default 100). */
export function getDeliveryThresholdGbpSync(): number {
  return (
    getQueryClient().getQueryData<number>(deliveryThresholdQueryKey) ??
    DEFAULT_FREE_DELIVERY_THRESHOLD_GBP
  );
}

/** Cold start — fetch once after market hydration. */
export function initDeliveryThresholdOnStartup(): Promise<number> {
  return fetchDeliveryThresholdQuery('startup');
}

/** Market/country switch — always refetch. */
export function reloadDeliveryThresholdForMarketChange(): Promise<number> {
  return fetchDeliveryThresholdQuery('market_change', { force: true });
}

/** Refetch when cache is stale after foreground resume. */
export function refreshDeliveryThresholdIfStale(): Promise<number> {
  const queryClient = getQueryClient();
  const state = queryClient.getQueryState(deliveryThresholdQueryKey);

  if (!state?.dataUpdatedAt) {
    return Promise.resolve(getDeliveryThresholdGbpSync());
  }

  const ageMs = Date.now() - state.dataUpdatedAt;
  if (ageMs < DELIVERY_THRESHOLD_STALE_MS) {
    return Promise.resolve(getDeliveryThresholdGbpSync());
  }

  return fetchDeliveryThresholdQuery('cache_expired', { force: true });
}
