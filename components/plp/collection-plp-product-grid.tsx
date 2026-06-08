import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import { forwardRef } from 'react';

import { useProductCardParentRerenderTrace } from '@/hooks/use-product-card-parent-rerender-trace';
import type { Product } from '@/types/shopify';

type Props = FlashListProps<Product> & {
  traceRenderItemRef?: unknown;
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
    ...rest
  }: Props,
  ref: React.Ref<FlashListRef<Product>>,
) {
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
      {...rest}
    />
  );
}

export const CollectionPlpProductGrid = forwardRef(CollectionPlpProductGridInner);

CollectionPlpProductGrid.displayName = 'CollectionPlpProductGrid';
