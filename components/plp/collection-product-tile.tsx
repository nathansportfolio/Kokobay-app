import { memo } from 'react';
import { View } from 'react-native';
import type { Href } from 'expo-router';

import { ProductCard } from '@/components/ui/product-card';
import { useProductCardParentRerenderTrace } from '@/hooks/use-product-card-parent-rerender-trace';
import type { SelectItemSourceScreen } from '@/lib/gtm/types';
import type { ProductPrefetchImageHint } from '@/hooks/use-prefetch-product';
import type { Product } from '@/types/shopify';
import { isProductFullySoldOut } from '@/utils/product-availability';

export type CollectionProductTileProps = {
  product: Product;
  productLink: Href;
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
  onPrefetchProduct?: (handle: string, imageHint?: ProductPrefetchImageHint) => void;
  selectItemContext?: {
    source_screen: SelectItemSourceScreen;
    item_list_id: string;
    item_list_name: string;
    index?: number;
    search_term?: string;
  };
};

function CollectionProductTileInner({
  product,
  productLink,
  itemWidth,
  cellHeight,
  numColumns,
  tileIndex,
  columnGap = 0,
  perfTraceIndex,
  perfTraceScreen,
  onPrefetchProduct,
  selectItemContext,
}: CollectionProductTileProps) {
  const columnGapAfter =
    numColumns === 2 && tileIndex != null && tileIndex % 2 === 0 && columnGap > 0 ? columnGap : 0;

  useProductCardParentRerenderTrace('CollectionProductTile', {
    productId: product.id,
    productLink,
    itemWidth,
    cellHeight,
    numColumns,
    tileIndex,
    columnGap,
    onPrefetchProductRef: onPrefetchProduct,
  });

  return (
    <View style={{ width: itemWidth, height: cellHeight, marginRight: columnGapAfter }}>
      <ProductCard
        product={product}
        productLink={productLink}
        imagePriority="low"
        gridColumns={numColumns}
        tileWidth={itemWidth}
        perfTraceIndex={perfTraceIndex}
        perfTraceScreen={perfTraceScreen}
        onPrefetchProduct={onPrefetchProduct}
        selectItemContext={selectItemContext}
      />
    </View>
  );
}

export const CollectionProductTile = memo(
  CollectionProductTileInner,
  (prev, next) =>
    prev.product.id === next.product.id &&
    prev.productLink === next.productLink &&
    prev.itemWidth === next.itemWidth &&
    prev.cellHeight === next.cellHeight &&
    prev.numColumns === next.numColumns &&
    prev.tileIndex === next.tileIndex &&
    prev.columnGap === next.columnGap &&
    prev.onPrefetchProduct === next.onPrefetchProduct &&
    prev.selectItemContext?.source_screen === next.selectItemContext?.source_screen &&
    prev.selectItemContext?.item_list_id === next.selectItemContext?.item_list_id &&
    prev.selectItemContext?.item_list_name === next.selectItemContext?.item_list_name &&
    prev.selectItemContext?.index === next.selectItemContext?.index &&
    prev.selectItemContext?.search_term === next.selectItemContext?.search_term &&
    prev.product.title === next.product.title &&
    prev.product.priceRange.minVariantPrice.amount === next.product.priceRange.minVariantPrice.amount &&
    isProductFullySoldOut(prev.product) === isProductFullySoldOut(next.product),
);
