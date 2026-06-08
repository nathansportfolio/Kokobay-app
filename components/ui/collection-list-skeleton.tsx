import { StyleSheet, View } from 'react-native';

import { CollectionStripSkeletonRow } from '@/components/shop/collection-strip-skeleton-row';
import { SHOP_COLLECTION_STRIP_GAP } from '@/components/shop/shop-collection-layout';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  layout?: 'compact' | 'editorial' | 'strip';
};

export function CollectionListSkeleton({ layout = 'compact' }: Props) {
  if (layout === 'strip') {
    return (
      <View style={{ gap: SHOP_COLLECTION_STRIP_GAP }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <CollectionStripSkeletonRow key={i} />
        ))}
      </View>
    );
  }

  if (layout === 'editorial') {
    return (
      <View className="-mx-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} className="mb-11">
            <View className="relative w-full overflow-hidden bg-warmElevated" style={{ aspectRatio: 4 / 5 }}>
              <Skeleton className="rounded-none" style={StyleSheet.absoluteFillObject} />
            </View>
            <View className="px-5 pt-5">
              <Skeleton className="mb-2 h-2.5 w-20 rounded-sm" />
              <Skeleton className="h-4 w-[72%] max-w-[280px] rounded-sm" />
              <Skeleton className="mt-3 h-3 w-full rounded-sm" />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} className="flex-row gap-4 overflow-hidden rounded-sm border border-line bg-surface p-3">
          <Skeleton className="h-20 w-16 rounded-sm" />
          <View className="flex-1 justify-center gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-3 w-full" />
          </View>
        </View>
      ))}
    </View>
  );
}
