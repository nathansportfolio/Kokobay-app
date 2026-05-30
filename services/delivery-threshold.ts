import {
  DEFAULT_FREE_DELIVERY_THRESHOLD_GBP,
  DELIVERY_THRESHOLD_CONTENT_SLUG,
} from '@/constants/delivery-threshold';
import { getQueryClient } from '@/hooks/use-query-client';
import { fetchDeliveryThresholdFromApi } from '@/services/kokobay-web/delivery-threshold-api';

const DELIVERY_THRESHOLD_QUERY_KEY = ['delivery-threshold'] as const;

const listeners = new Set<() => void>();

let cachedGbp = DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;
let inflight: Promise<number> | null = null;

function setCachedGbp(next: number): void {
  if (cachedGbp === next) return;
  cachedGbp = next;
  for (const listener of listeners) listener();
  try {
    getQueryClient().invalidateQueries({ queryKey: [...DELIVERY_THRESHOLD_QUERY_KEY] });
    /** Legacy PDP/content queries — harmless if unused. */
    getQueryClient().invalidateQueries({
      queryKey: ['app-content', DELIVERY_THRESHOLD_CONTENT_SLUG],
    });
  } catch {
    /** Query client not ready during early bootstrap. */
  }
}

/** Latest known threshold (last fetch or default 100). */
export function getDeliveryThresholdGbpSync(): number {
  return cachedGbp;
}

export function subscribeDeliveryThreshold(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Loads `delivery_threshold` from `GET /api/delivery-threshold`; safe to call repeatedly (deduped). */
export function ensureDeliveryThresholdLoaded(): Promise<number> {
  if (inflight) return inflight;

  inflight = fetchDeliveryThresholdFromApi()
    .then((value) => {
      const next = value ?? DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;
      setCachedGbp(next);
      return next;
    })
    .catch(() => cachedGbp)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
