import { memo } from 'react';
import { View } from 'react-native';

import { WishlistSavedCard } from '@/components/wishlist/wishlist-saved-card';
import { useWishlist } from '@/contexts/wishlist-context';
import type { Product } from '@/types/shopify';

type WishlistGridItemProps = {
  handle: string;
  product: Product | undefined;
  isPending: boolean;
  index: number;
  tileWidth: number;
  imageHeight: number;
  cellHeight: number;
  columnGap: number;
};

function WishlistGridItemInner({
  handle,
  product,
  isPending,
  index,
  tileWidth,
  imageHeight,
  cellHeight,
  columnGap,
}: WishlistGridItemProps) {
  const { toggleWishlist } = useWishlist();
  const columnGapAfter = index % 2 === 0 && columnGap > 0 ? columnGap : 0;

  return (
    <View
      style={{
        width: tileWidth,
        height: cellHeight,
        marginRight: columnGapAfter,
      }}>
      <WishlistSavedCard
        handle={handle}
        product={product}
        isPending={isPending}
        index={index}
        tileWidth={tileWidth}
        imageHeight={imageHeight}
        onRemove={toggleWishlist}
      />
    </View>
  );
}

export const WishlistGridItem = memo(WishlistGridItemInner);
