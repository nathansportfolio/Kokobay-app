import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { logPlpScrollDebug } from '@/lib/plp-scroll-debug';

type Options = {
  screen: string;
  itemCount: number;
  isFetchingNextPage: boolean;
  contentHeight?: number;
};

/**
 * Records scroll offset and logs append / footer / fetch lifecycle for PLP investigation.
 */
export function usePlpScrollOffsetTrace({
  screen,
  itemCount,
  isFetchingNextPage,
}: Options) {
  const scrollYRef = useRef(0);
  const contentHeightRef = useRef(0);
  const itemCountRef = useRef(itemCount);
  const wasFetchingRef = useRef(isFetchingNextPage);
  const scrollAtFetchStartRef = useRef<number | null>(null);
  const countAtFetchStartRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = itemCountRef.current;
    if (prev === itemCount) return;

    logPlpScrollDebug('itemCount_changed', {
      screen,
      itemCountBefore: prev,
      itemCountAfter: itemCount,
      delta: itemCount - prev,
      scrollY: Math.round(scrollYRef.current),
      contentHeight: Math.round(contentHeightRef.current),
      scrollAtFetchStart: scrollAtFetchStartRef.current,
      countAtFetchStart: countAtFetchStartRef.current,
    });

    if (countAtFetchStartRef.current != null && itemCount > countAtFetchStartRef.current) {
      logPlpScrollDebug('append_complete', {
        screen,
        itemCountBefore: countAtFetchStartRef.current,
        itemCountAfter: itemCount,
        scrollBeforeFetch: scrollAtFetchStartRef.current,
        scrollAfterAppend: Math.round(scrollYRef.current),
        scrollDelta:
          scrollAtFetchStartRef.current == null
            ? null
            : Math.round(scrollYRef.current - scrollAtFetchStartRef.current),
        contentHeight: Math.round(contentHeightRef.current),
      });
      scrollAtFetchStartRef.current = null;
      countAtFetchStartRef.current = null;
    }

    itemCountRef.current = itemCount;
  }, [itemCount, screen]);

  useEffect(() => {
    if (wasFetchingRef.current === isFetchingNextPage) return;

    logPlpScrollDebug(isFetchingNextPage ? 'footer_spinner_show' : 'footer_spinner_hide', {
      screen,
      itemCount,
      scrollY: Math.round(scrollYRef.current),
      contentHeight: Math.round(contentHeightRef.current),
    });

    if (isFetchingNextPage) {
      scrollAtFetchStartRef.current = scrollYRef.current;
      countAtFetchStartRef.current = itemCount;
      logPlpScrollDebug('scroll_snapshot_before_fetch', {
        screen,
        scrollY: Math.round(scrollYRef.current),
        contentHeight: Math.round(contentHeightRef.current),
        itemCount,
      });
    } else if (scrollAtFetchStartRef.current != null) {
      logPlpScrollDebug('scroll_snapshot_after_fetch', {
        screen,
        scrollY: Math.round(scrollYRef.current),
        contentHeight: Math.round(contentHeightRef.current),
        itemCount,
        scrollDelta: Math.round(scrollYRef.current - scrollAtFetchStartRef.current),
      });
    }

    wasFetchingRef.current = isFetchingNextPage;
  }, [isFetchingNextPage, itemCount, screen]);

  const onScrollOffsetTrace = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
    contentHeightRef.current = event.nativeEvent.contentSize.height;
  }, []);

  const chainScrollHandler = useCallback(
    (handler?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void) =>
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        onScrollOffsetTrace(event);
        handler?.(event);
      },
    [onScrollOffsetTrace],
  );

  return { chainScrollHandler };
}
