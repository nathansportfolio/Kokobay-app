import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { PRODUCT_CARD_FOOTER_CTA_BLOCK, productCardTextBlockHeight } from '@/constants/product-card-typography';
import { collectionProductImageHeight } from '@/utils/plp-layout';

export type ProductGridSkeletonProps = {
  columns?: 1 | 2;
  rows?: number;
  /** When set with `cellHeight`, skeleton cells match PLP FlashList dimensions. */
  itemWidth?: number;
  cellHeight?: number;
  columnGap?: number;
  /** Matches `ProductCard` `actionVariant="add_to_bag"`. */
  withFooterCta?: boolean;
};

export function ProductGridSkeleton({
  columns = 2,
  rows = 3,
  itemWidth,
  cellHeight,
  columnGap = 12,
  withFooterCta = false,
}: ProductGridSkeletonProps) {
  const count = columns * rows;

  if (itemWidth != null && cellHeight != null) {
    const imageH = collectionProductImageHeight(itemWidth);
    const cta = PRODUCT_CARD_FOOTER_CTA_BLOCK;
    return (
      <View className="flex-row flex-wrap" style={{ columnGap, rowGap: 0 }}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={{ width: itemWidth, height: cellHeight }}>
            <Skeleton className="rounded-none" style={{ width: itemWidth, height: imageH }} />
            {withFooterCta ? (
              <View className="flex-1 justify-between">
                <View style={{ height: productCardTextBlockHeight(columns) }} className="gap-2 px-2 pt-2">
                  <Skeleton className="h-3 rounded-sm" style={{ width: Math.round(itemWidth * 0.72) }} />
                  <Skeleton className="h-3 rounded-sm" style={{ width: Math.round(itemWidth * 0.45) }} />
                </View>
                <Skeleton
                  className="rounded-none"
                  style={{
                    marginTop: cta.paddingTop,
                    marginBottom: cta.paddingBottom,
                    marginHorizontal: cta.paddingHorizontal,
                    width: itemWidth - cta.paddingHorizontal * 2,
                    height: cta.buttonHeight,
                  }}
                />
              </View>
            ) : (
              <View className="mt-2 gap-2">
                <Skeleton className="h-3 rounded-sm" style={{ width: Math.round(itemWidth * 0.72) }} />
                <Skeleton className="h-3 rounded-sm" style={{ width: Math.round(itemWidth * 0.45) }} />
              </View>
            )}
          </View>
        ))}
      </View>
    );
  }

  const itemWidthClass = columns === 1 ? 'w-full' : 'w-[48%]';
  return (
    <View className="flex-row flex-wrap justify-between gap-y-5">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className={`${itemWidthClass} gap-2`}>
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="h-3 w-[70%]" />
          <Skeleton className="h-3 w-[45%]" />
        </View>
      ))}
    </View>
  );
}
