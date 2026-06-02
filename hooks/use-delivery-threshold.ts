import { useSyncExternalStore } from 'react';

import { DEFAULT_FREE_DELIVERY_THRESHOLD_GBP } from '@/constants/delivery-threshold';
import {
  getDeliveryThresholdGbpSync,
  subscribeDeliveryThreshold,
} from '@/services/delivery-threshold';

/** Free UK delivery minimum from cached `GET /api/delivery-threshold`, default 100 GBP. */
export function useDeliveryThreshold(): number {
  return useSyncExternalStore(
    subscribeDeliveryThreshold,
    () => getDeliveryThresholdGbpSync(),
    () => DEFAULT_FREE_DELIVERY_THRESHOLD_GBP,
  );
}
