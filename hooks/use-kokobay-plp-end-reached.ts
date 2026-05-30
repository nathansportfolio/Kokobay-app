import { useCallback, useEffect, useRef } from 'react';

import { logPlpScrollDebug } from '@/lib/plp-scroll-debug';

/** Minimum gap between catalog page fetches (fast scroll can spam `onEndReached`). */
export const KOKOBAY_PLP_FETCH_COOLDOWN_MS = 2000;

type Options = {
  screen: string;
  enabled: boolean;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  /** Current rendered product count — used to detect append before next fetch. */
  itemCount: number;
  minIntervalMs?: number;
};

type BlockReason =
  | 'disabled'
  | 'no_next_page'
  | 'fetching'
  | 'awaiting_growth'
  | 'cooldown';

/**
 * Guarded `onEndReached` for append-only Koko Bay catalog infinite scroll.
 * Enforces cooldown + waits for the list to grow before fetching again.
 */
export function useKokobayPlpEndReached({
  screen,
  enabled,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  itemCount,
  minIntervalMs = KOKOBAY_PLP_FETCH_COOLDOWN_MS,
}: Options) {
  const lastFetchAtRef = useRef(0);
  const awaitingGrowthRef = useRef(false);
  const countAtFetchRef = useRef(0);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchSeqRef = useRef(0);
  const endReachedCountRef = useRef(0);

  useEffect(() => {
    if (itemCount < countAtFetchRef.current) {
      awaitingGrowthRef.current = false;
      countAtFetchRef.current = itemCount;
      lastFetchAtRef.current = 0;
      endReachedCountRef.current = 0;
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
      logPlpScrollDebug('guards_reset', { screen, itemCount, reason: 'item_count_decreased' });
      return;
    }
    if (awaitingGrowthRef.current && itemCount > countAtFetchRef.current) {
      awaitingGrowthRef.current = false;
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
      logPlpScrollDebug('awaiting_growth_cleared', {
        screen,
        itemCountBefore: countAtFetchRef.current,
        itemCountAfter: itemCount,
      });
    }
  }, [itemCount, screen]);

  useEffect(
    () => () => {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
      }
    },
    [],
  );

  return useCallback(() => {
    endReachedCountRef.current += 1;
    const endReachedSeq = endReachedCountRef.current;

    let blockReason: BlockReason | null = null;
    if (!enabled) blockReason = 'disabled';
    else if (!hasNextPage) blockReason = 'no_next_page';
    else if (isFetchingNextPage) blockReason = 'fetching';
    else if (awaitingGrowthRef.current) blockReason = 'awaiting_growth';
    else if (lastFetchAtRef.current > 0 && Date.now() - lastFetchAtRef.current < minIntervalMs) {
      blockReason = 'cooldown';
    }

    if (blockReason) {
      logPlpScrollDebug('onEndReached_blocked', {
        screen,
        endReachedSeq,
        blockReason,
        itemCount,
        hasNextPage,
        isFetchingNextPage,
        awaitingGrowth: awaitingGrowthRef.current,
        msSinceLastFetch: lastFetchAtRef.current > 0 ? Date.now() - lastFetchAtRef.current : null,
      });
      return;
    }

    const fetchId = ++fetchSeqRef.current;
    const itemCountBefore = itemCount;

    logPlpScrollDebug('onEndReached_fired', {
      screen,
      endReachedSeq,
      fetchId,
      itemCountBefore,
    });

    lastFetchAtRef.current = Date.now();
    countAtFetchRef.current = itemCount;
    awaitingGrowthRef.current = true;

    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
    }
    releaseTimerRef.current = setTimeout(() => {
      if (awaitingGrowthRef.current) {
        logPlpScrollDebug('awaiting_growth_timeout_release', { screen, fetchId, itemCount });
      }
      awaitingGrowthRef.current = false;
      releaseTimerRef.current = null;
    }, minIntervalMs);

    logPlpScrollDebug('fetchNextPage_start', { screen, fetchId, itemCountBefore });

    void fetchNextPage()
      .then(() => {
        logPlpScrollDebug('fetchNextPage_success', {
          screen,
          fetchId,
          itemCountBefore,
        });
      })
      .catch((error) => {
        logPlpScrollDebug('fetchNextPage_error', {
          screen,
          fetchId,
          itemCountBefore,
          error: String(error),
        });
      });
  }, [
    enabled,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    itemCount,
    minIntervalMs,
    screen,
  ]);
}
