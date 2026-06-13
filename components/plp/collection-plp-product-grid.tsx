import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useRef } from 'react';
import { Platform } from 'react-native';

import {
  plpGridGalleryPrefetchFromProduct,
  usePlpGridViewability,
  plpGridProductIdFromItem,
} from '@/hooks/use-plp-grid-viewability';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { useProductCardParentRerenderTrace } from '@/hooks/use-product-card-parent-rerender-trace';
import type { Product } from '@/types/shopify';

type Props = FlashListProps<Product> & {
  traceRenderItemRef?: unknown;
  /** When false, skips viewport visibility tracking for product card prefetch. @default true */
  trackProductCardVisibility?: boolean;
};

/**
 * Collection PLP product grid — FlashList wrapper with dev parent-rerender tracing.
 * (There is no separate ProductGrid component; this is the list/grid boundary.)
 */
function CollectionPlpProductGridInner(
  {
    data,
    extraData,
    renderItem,
    numColumns,
    traceRenderItemRef,
    trackProductCardVisibility = true,
    onViewableItemsChanged: onViewableItemsChangedProp,
    viewabilityConfig: viewabilityConfigProp,
    ...rest
  }: Props,
  ref: React.Ref<FlashListRef<Product>>,
) {
  const queryClient = useQueryClient();
  const marketKey = useMarketQueryKey();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;
  const marketKeyRef = useRef(marketKey);
  marketKeyRef.current = marketKey;

  const gridViewability = usePlpGridViewability<Product>({
    resolveProductId: plpGridProductIdFromItem,
    resolveGalleryPrefetch: trackProductCardVisibility
      ? plpGridGalleryPrefetchFromProduct
      : undefined,
    queryClientRef,
    marketKeyRef,
    enabled: trackProductCardVisibility,
  });

  useProductCardParentRerenderTrace('ProductGrid', {
    dataRef: data,
    dataLen: data?.length ?? 0,
    extraData,
    renderItemRef: traceRenderItemRef ?? renderItem,
    numColumns,
  });

  return (
    <FlashList<Product>
      ref={ref}
      data={data}
      extraData={extraData}
      renderItem={renderItem}
      numColumns={numColumns}
      onViewableItemsChanged={
        onViewableItemsChangedProp ?? gridViewability.onViewableItemsChanged
      }
      viewabilityConfig={viewabilityConfigProp ?? gridViewability.viewabilityConfig}
      {...(Platform.OS === 'ios' ? { contentInsetAdjustmentBehavior: 'never' as const } : {})}
      {...rest}
    />
  );
}

export const CollectionPlpProductGrid = forwardRef(CollectionPlpProductGridInner);

CollectionPlpProductGrid.displayName = 'CollectionPlpProductGrid';
