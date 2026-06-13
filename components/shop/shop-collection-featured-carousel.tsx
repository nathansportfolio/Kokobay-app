import { memo, useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { ShopCollectionFeaturedTile } from '@/components/shop/shop-collection-featured-tile';
import {
  COLLECTIONS_TAB_FEATURED_GAP,
  COLLECTIONS_TAB_HORIZONTAL_PAD,
  collectionsTabFeaturedCarouselHeight,
  collectionsTabFeaturedCarouselTileWidth,
} from '@/constants/collections-tab';
import type { CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';

type Props = {
  items: CmsCollectionDisplayItem[];
  screenWidth: number;
  loading?: boolean;
};

function ShopCollectionFeaturedCarouselInner({ items, screenWidth, loading = false }: Props) {
  const tileWidth = collectionsTabFeaturedCarouselTileWidth(screenWidth);
  const carouselHeight = collectionsTabFeaturedCarouselHeight(screenWidth);
  const snapInterval = tileWidth + COLLECTIONS_TAB_FEATURED_GAP;

  const skeletonItems = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => ({
        collection: {
          id: `carousel-skeleton-${index}`,
          handle: `carousel-skeleton-${index}`,
          title: '',
          image: { url: 'https://placeholder.local/skeleton' },
        },
        cmsUrl: undefined as string | undefined,
      })),
    [],
  );

  const displayItems = loading ? skeletonItems : items;

  if (!displayItems.length) {
    return null;
  }

  return (
    <View style={{ height: carouselHeight }}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: COLLECTIONS_TAB_HORIZONTAL_PAD,
          paddingRight: COLLECTIONS_TAB_HORIZONTAL_PAD + COLLECTIONS_TAB_FEATURED_GAP,
        }}>
        {displayItems.map((item, index) => (
          <View
            key={item.collection.id}
            style={{
              width: tileWidth,
              marginRight: index === displayItems.length - 1 ? 0 : COLLECTIONS_TAB_FEATURED_GAP,
            }}>
            <ShopCollectionFeaturedTile
              item={item}
              tileWidth={tileWidth}
              screenWidth={screenWidth}
              imagePriority={index < 3 ? 'normal' : 'low'}
              loading={loading}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export const ShopCollectionFeaturedCarousel = memo(
  ShopCollectionFeaturedCarouselInner,
  (prev, next) =>
    prev.loading === next.loading &&
    prev.screenWidth === next.screenWidth &&
    prev.items.length === next.items.length &&
    prev.items.every(
      (item, index) =>
        item.collection.id === next.items[index]?.collection.id &&
        item.collection.handle === next.items[index]?.collection.handle &&
        item.collection.title === next.items[index]?.collection.title &&
        item.cmsUrl === next.items[index]?.cmsUrl,
    ),
);

ShopCollectionFeaturedCarousel.displayName = 'ShopCollectionFeaturedCarousel';
