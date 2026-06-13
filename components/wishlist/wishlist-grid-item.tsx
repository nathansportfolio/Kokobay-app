import { memo } from 'react';
import { View } from 'react-native';
import type { Href } from 'expo-router';

import { CollectionProductTile } from '@/components/plp/collection-product-tile';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PRODUCT_CARD_FOOTER_CTA_BLOCK,
  productCardTextBlockHeight,
} from '@/constants/product-card-typography';
import type { Product } from '@/types/shopify';
import { collectionProductImageHeight } from '@/utils/plp-layout';

type WishlistGridItemProps = {
  handle: string;
  product: Product | undefined;
  isPending: boolean;
  index: number;
  productLink: Href;
  tileWidth: number;
  cellHeight: number;
  columnGap: number;
};

function WishlistTileSkeleton({
  itemWidth,
  cellHeight,
}: {
  itemWidth: number;
  cellHeight: number;
}) {
  const imageH = collectionProductImageHeight(itemWidth);
  const textBlockH = productCardTextBlockHeight(2);
  const cta = PRODUCT_CARD_FOOTER_CTA_BLOCK;
  return (
    <View style={{ width: itemWidth, height: cellHeight }}>
      <Skeleton className="rounded-none bg-warmElevated/85" style={{ width: itemWidth, height: imageH }} />
      <View className="flex-1 justify-between">
        <View style={{ height: textBlockH }} className="gap-1 px-2 pt-2">
          <Skeleton className="h-3 rounded-sm bg-warmElevated/75" style={{ width: Math.round(itemWidth * 0.72) }} />
          <Skeleton className="h-3 rounded-sm bg-warmElevated/65" style={{ width: Math.round(itemWidth * 0.45) }} />
        </View>
        <Skeleton
          className="rounded-none bg-warmElevated/75"
          style={{
            marginTop: cta.paddingTop,
            marginBottom: cta.paddingBottom,
            marginHorizontal: cta.paddingHorizontal,
            width: itemWidth - cta.paddingHorizontal * 2,
            height: cta.buttonHeight,
          }}
        />
      </View>
    </View>
  );
}

function WishlistGridItemInner({
  product,
  isPending,
  index,
  productLink,
  tileWidth,
  cellHeight,
  columnGap,
}: WishlistGridItemProps) {
  const columnGapAfter = index % 2 === 0 && columnGap > 0 ? columnGap : 0;
  const showSkeleton = isPending || !product;

  if (showSkeleton) {
    return (
      <View
        style={{
          width: tileWidth,
          height: cellHeight,
          marginRight: columnGapAfter,
        }}>
        <WishlistTileSkeleton itemWidth={tileWidth} cellHeight={cellHeight} />
      </View>
    );
  }

  return (
    <CollectionProductTile
      product={product}
      productLink={productLink}
      itemWidth={tileWidth}
      cellHeight={cellHeight}
      numColumns={2}
      tileIndex={index}
      columnGap={columnGap}
      actionVariant="add_to_bag"
      perfTraceScreen="wishlist"
      selectItemContext={{
        source_screen: 'wishlist',
        item_list_id: 'wishlist',
        item_list_name: 'Wishlist',
        index,
      }}
    />
  );
}

export const WishlistGridItem = memo(WishlistGridItemInner);
