import { StyleSheet, View } from 'react-native';

import {
  SHOP_COLLECTION_STRIP_BORDER_RADIUS,
  SHOP_COLLECTION_STRIP_GAP,
  SHOP_COLLECTION_STRIP_HEIGHT,
  SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING,
  shopCollectionStripCardShadow,
} from '@/components/shop/shop-collection-layout';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  layout?: 'compact' | 'editorial' | 'strip';
};

export function CollectionListSkeleton({ layout = 'compact' }: Props) {
  if (layout === 'strip') {
    return (
      <View style={{ gap: SHOP_COLLECTION_STRIP_GAP }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={{ paddingHorizontal: SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING }}>
            <View
              style={{
                ...shopCollectionStripCardShadow,
                borderRadius: SHOP_COLLECTION_STRIP_BORDER_RADIUS,
              }}>
              <View
                style={{
                  position: 'relative',
                  width: '100%',
                  height: SHOP_COLLECTION_STRIP_HEIGHT,
                  overflow: 'hidden',
                  backgroundColor: '#F5F3F0',
                  borderRadius: SHOP_COLLECTION_STRIP_BORDER_RADIUS,
                }}>
                <Skeleton
                  style={[StyleSheet.absoluteFillObject, { borderRadius: SHOP_COLLECTION_STRIP_BORDER_RADIUS }]}
                />
                <View
                  pointerEvents="none"
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    borderRadius: SHOP_COLLECTION_STRIP_BORDER_RADIUS,
                    backgroundColor: 'rgba(28, 26, 24, 0.48)',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: 'flex-end',
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                  }}>
                  <Skeleton style={{ marginBottom: 6, height: 10, width: 64, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' }} />
                  <Skeleton style={{ height: 16, width: '58%', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' }} />
                </View>
              </View>
            </View>
          </View>
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
