import { memo } from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { productCardTextBlockHeight } from '@/constants/product-card-typography';
import { collectionProductImageHeight } from '@/utils/plp-layout';

type Props = {
  tileWidth: number;
  /** Number of cards to paint (row may clip for peek effect). */
  count?: number;
  tileGap?: number;
};

function SearchCarouselSkeletonInner({ tileWidth, count = 5, tileGap = 16 }: Props) {
  const imageH = collectionProductImageHeight(tileWidth);
  const textH = productCardTextBlockHeight(2);

  return (
    <View className="flex-row">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: tileWidth, marginRight: i === count - 1 ? 0 : tileGap }}>
          <Skeleton className="rounded-none" style={{ width: '100%', height: imageH }} />
          <View style={{ height: textH }} className="gap-2 px-2 pt-2">
            <Skeleton className="h-3 rounded-sm" style={{ width: Math.round(tileWidth * 0.72) }} />
            <Skeleton className="h-3 rounded-sm" style={{ width: Math.round(tileWidth * 0.45) }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export const SearchCarouselSkeleton = memo(SearchCarouselSkeletonInner);

type SuggestionsSkeletonProps = {
  /** Number of suggestion rows to paint. */
  count?: number;
};

function SearchSuggestionsSkeletonInner({ count = 3 }: SuggestionsSkeletonProps) {
  return (
    <View className="mt-3">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="border-b border-line/40 py-3.5">
          <Skeleton className="h-4 rounded-md" style={{ width: `${58 + (i % 3) * 12}%` }} />
        </View>
      ))}
    </View>
  );
}

export const SearchSuggestionsSkeleton = memo(SearchSuggestionsSkeletonInner);
