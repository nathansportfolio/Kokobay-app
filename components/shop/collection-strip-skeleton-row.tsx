import { StyleSheet, View } from 'react-native';

import {
  SHOP_COLLECTION_STRIP_BORDER_RADIUS,
  SHOP_COLLECTION_STRIP_HEIGHT,
  SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING,
  shopCollectionStripCardShadow,
} from '@/components/shop/shop-collection-layout';
import { Skeleton } from '@/components/ui/skeleton';

/** Single strip row — matches `ShopCollectionEditorialCard` strip layout for FlashList. */
export function CollectionStripSkeletonRow() {
  return (
    <View style={{ paddingHorizontal: SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING }}>
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
              backgroundColor: 'rgba(28, 26, 24, 0.32)',
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
            <Skeleton
              style={{
                marginBottom: 6,
                height: 10,
                width: 64,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.35)',
              }}
            />
            <Skeleton
              style={{ height: 16, width: '58%', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
