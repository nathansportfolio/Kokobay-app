import { useEffect, useRef } from 'react';

import {
  isProductCardDiffTraceActive,
  recordCollectionPlpRender,
} from '@/lib/product-card-storm-trace';
import type { Product } from '@/types/shopify';

type Options = {
  screen: 'collection' | 'search';
  allProducts: Product[] | undefined;
  flatItems: Product[];
  queryDataUpdatedAt?: number;
  isFetching?: boolean;
  /** Stable label for why this effect ran (filters, catalog, layout, etc.). */
  reason: string;
};

/**
 * Dev-only — logs `[COLLECTION_DATA]` when PLP list inputs change reference.
 * Enable with `EXPO_PUBLIC_PRODUCT_CARD_DIFF=1` or freeze/foreground audit flags.
 */
export function useCollectionPlpRenderTrace({
  screen,
  allProducts,
  flatItems,
  queryDataUpdatedAt,
  isFetching,
  reason,
}: Options): void {
  const prevReasonRef = useRef(reason);

  useEffect(() => {
    if (!isProductCardDiffTraceActive()) return;

    const effectiveReason =
      prevReasonRef.current !== reason ? `${reason}:reason_changed` : reason;
    prevReasonRef.current = reason;

    recordCollectionPlpRender({
      screen,
      reason: effectiveReason,
      allProducts,
      flatItems,
      queryDataUpdatedAt,
      isFetching,
    });
  }, [screen, allProducts, flatItems, queryDataUpdatedAt, isFetching, reason]);
}
