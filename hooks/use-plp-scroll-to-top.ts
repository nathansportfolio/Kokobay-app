import type { FlashListRef } from '@shopify/flash-list';
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

import type { PlpFilters, PlpSort } from '@/types/plp';
import type { Product } from '@/types/shopify';

type UsePlpScrollToTopOptions = {
  sort: PlpSort;
  filters: PlpFilters;
  /** Collection handle or search query — resets scroll when the PLP scope changes. */
  scopeKey: string;
  /** `dataUpdatedAt` from the active catalog query; scroll again once new rows land. */
  dataEpoch: number;
  /** Dev audit — called before each `scrollToOffset`. */
  onScrollToOffset?: (reason: string) => void;
};

/**
 * Keeps PLP grids pinned to the top when sort/filters change.
 * Scrolls immediately and again after catalog data updates (FlashList may ignore the first call).
 */
export function usePlpScrollToTop(
  listRef: RefObject<FlashListRef<Product> | null>,
  { sort, filters, scopeKey, dataEpoch, onScrollToOffset }: UsePlpScrollToTopOptions,
): void {
  const didMountRef = useRef(false);
  const scrollAfterDataRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    scrollAfterDataRef.current = true;
    onScrollToOffset?.('usePlpScrollToTop:sort-filters-scope');
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [sort, filters, scopeKey, listRef, onScrollToOffset]);

  useLayoutEffect(() => {
    if (!scrollAfterDataRef.current) return;
    onScrollToOffset?.('usePlpScrollToTop:dataEpoch');
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    scrollAfterDataRef.current = false;
  }, [dataEpoch, sort, listRef, onScrollToOffset]);
}
