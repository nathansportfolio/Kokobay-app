import { memo } from 'react';
import { View } from 'react-native';

import { ProductCard } from '@/components/ui/product-card';
import type { Product } from '@/types/shopify';
import { isProductFullySoldOut } from '@/utils/product-availability';

export type CollectionProductTileProps = {
  product: Product;
  itemWidth: number;
  /** Fixed row height for FlashList multi-column grid (uniform cells). */
  cellHeight: number;
  numColumns: 1 | 2;
  /** FlashList index — used to insert the column gap in two-up mode. */
  tileIndex?: number;
  /** Horizontal gap between left and right columns (two-up only). */
  columnGap?: number;
  perfTraceIndex?: number;
  perfTraceScreen?: string;
};

function CollectionProductTileInner({
  product,
  itemWidth,
  cellHeight,
  numColumns,
  tileIndex,
  columnGap = 0,
  perfTraceIndex,
  perfTraceScreen,
}: CollectionProductTileProps) {
  const columnGapAfter =
    numColumns === 2 && tileIndex != null && tileIndex % 2 === 0 && columnGap > 0 ? columnGap : 0;

  return (
    <View style={{ width: itemWidth, height: cellHeight, marginRight: columnGapAfter }}>
      <ProductCard
        product={product}
        imagePriority="low"
        gridColumns={numColumns}
        tileWidth={itemWidth}
        perfTraceIndex={perfTraceIndex}
        perfTraceScreen={perfTraceScreen}
      />
    </View>
  );
}

export const CollectionProductTile = memo(
  CollectionProductTileInner,
  (prev, next) =>
    prev.product.id === next.product.id &&
    prev.itemWidth === next.itemWidth &&
    prev.cellHeight === next.cellHeight &&
    prev.numColumns === next.numColumns &&
    prev.tileIndex === next.tileIndex &&
    prev.columnGap === next.columnGap &&
    prev.product.title === next.product.title &&
    prev.product.priceRange.minVariantPrice.amount === next.product.priceRange.minVariantPrice.amount &&
    isProductFullySoldOut(prev.product) === isProductFullySoldOut(next.product),
);
