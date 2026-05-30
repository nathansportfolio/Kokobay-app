import { memo } from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  tileWidth: number;
  /** Number of cards to paint (row may clip for peek effect). */
  count?: number;
};

function SearchCarouselSkeletonInner({ tileWidth, count = 5 }: Props) {
  const imageH = Math.ceil(tileWidth * (4 / 3));

  return (
    <View className="flex-row">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: tileWidth }} className="mr-4">
          <Skeleton className="rounded-2xl" style={{ width: '100%', height: imageH }} />
          <View className="mt-3 gap-2 px-1">
            <Skeleton className="h-3.5 w-[88%] rounded-md" />
            <Skeleton className="h-3 w-[45%] rounded-md" />
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
