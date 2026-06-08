import { useQuery } from '@tanstack/react-query';

import { DEFAULT_FREE_DELIVERY_THRESHOLD_GBP } from '@/constants/delivery-threshold';
import { fetchDeliveryThresholdFromApi } from '@/services/kokobay-web/delivery-threshold-api';
import { DELIVERY_THRESHOLD_STALE_MS } from '@/src/core/query/delivery-threshold-query';
import { deliveryThresholdQueryKey } from '@/src/core/query/query-keys';

/** Free UK delivery minimum from `GET /api/delivery-threshold`, default 100 GBP. */
export function useDeliveryThreshold(): number {
  const query = useQuery({
    queryKey: deliveryThresholdQueryKey,
    staleTime: DELIVERY_THRESHOLD_STALE_MS,
    queryFn: async () => {
      const value = await fetchDeliveryThresholdFromApi();
      return value ?? DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;
    },
    placeholderData: DEFAULT_FREE_DELIVERY_THRESHOLD_GBP,
  });

  return query.data ?? DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;
}
