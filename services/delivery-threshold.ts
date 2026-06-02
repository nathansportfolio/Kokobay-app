import {
  DEFAULT_FREE_DELIVERY_THRESHOLD_GBP,
  DELIVERY_THRESHOLD_CONTENT_SLUG,
} from '@/constants/delivery-threshold';
import { getQueryClient } from '@/hooks/use-query-client';
import { fetchDeliveryThresholdFromApi } from '@/services/kokobay-web/delivery-threshold-api';

const DELIVERY_THRESHOLD_QUERY_KEY = ['delivery-threshold'] as const;
const CACHE_MAX_AGE_MS = 30 * 60_000;

export type DeliveryThresholdLoadSource = 'startup' | 'market_change' | 'cache_expired';

const listeners = new Set<() => void>();

let cachedGbp = DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;
let cachedAtMs = 0;
let inflight: Promise<number> | null = null;

function cacheAgeMs(now = Date.now()): number {
  return cachedAtMs > 0 ? now - cachedAtMs : 0;
}

function isCacheFresh(now = Date.now()): boolean {
  return cachedAtMs > 0 && cacheAgeMs(now) < CACHE_MAX_AGE_MS;
}

function logDeliveryThreshold(
  source: DeliveryThresholdLoadSource,
  threshold: number,
  ageMs: number,
): void {
  console.log('[DELIVERY THRESHOLD]', { source, threshold, ageMs });
}

function setCachedGbp(next: number): void {
  const changed = cachedGbp !== next;
  cachedGbp = next;
  cachedAtMs = Date.now();
  if (!changed) return;
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

async function fetchAndCache(
  source: DeliveryThresholdLoadSource,
): Promise<number> {
  const ageMsBeforeFetch = cacheAgeMs();
  try {
    const value = await fetchDeliveryThresholdFromApi();
    const next = value ?? DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;
    setCachedGbp(next);
    logDeliveryThreshold(source, next, ageMsBeforeFetch);
    return next;
  } catch {
    logDeliveryThreshold(source, cachedGbp, ageMsBeforeFetch);
    return cachedGbp;
  }
}

function loadDeliveryThreshold(
  source: DeliveryThresholdLoadSource,
  options?: { force?: boolean },
): Promise<number> {
  if (!options?.force && isCacheFresh()) {
    return Promise.resolve(cachedGbp);
  }
  if (inflight) return inflight;

  inflight = fetchAndCache(source).finally(() => {
    inflight = null;
  });

  return inflight;
}

/** Latest known threshold (last fetch or default 100). */
export function getDeliveryThresholdGbpSync(): number {
  return cachedGbp;
}

export function subscribeDeliveryThreshold(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Cold start — fetch once after market hydration. */
export function initDeliveryThresholdOnStartup(): Promise<number> {
  return loadDeliveryThreshold('startup');
}

/** Market/country switch — always refetch. */
export function reloadDeliveryThresholdForMarketChange(): Promise<number> {
  return loadDeliveryThreshold('market_change', { force: true });
}

/** Optional safeguard — refetch when cache is older than 30 minutes. */
export function refreshDeliveryThresholdIfStale(): Promise<number> {
  if (cachedAtMs === 0) {
    return inflight ?? Promise.resolve(cachedGbp);
  }
  if (isCacheFresh()) {
    return Promise.resolve(cachedGbp);
  }
  return loadDeliveryThreshold('cache_expired');
}
