import { useEffect, useSyncExternalStore } from 'react';

import { DEFAULT_FREE_DELIVERY_THRESHOLD_GBP } from '@/constants/delivery-threshold';
import {
  ensureDeliveryThresholdLoaded,
  getDeliveryThresholdGbpSync,
  subscribeDeliveryThreshold,
} from '@/services/delivery-threshold';
/** Free UK delivery minimum from `GET /api/delivery-threshold`, default 100 GBP. */
export function useDeliveryThreshold(): number {
  useEffect(() => {
    void ensureDeliveryThresholdLoaded();
  }, []);

  return useSyncExternalStore(
    subscribeDeliveryThreshold,
    () => getDeliveryThresholdGbpSync(),
    () => DEFAULT_FREE_DELIVERY_THRESHOLD_GBP,
  );
}
