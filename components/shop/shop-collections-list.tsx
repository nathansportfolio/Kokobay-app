import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { forwardRef, useCallback, useEffect, useMemo, type ReactElement } from 'react';
import { View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type RefreshControlProps } from 'react-native';

import { ShopCollectionFeaturedCarousel } from '@/components/shop/shop-collection-featured-carousel';
import { ShopCollectionNavRow } from '@/components/shop/shop-collection-nav-row';
import {
  buildCollectionsTabListItems,
  COLLECTIONS_TAB_SECTION_SPACER,
  COLLECTIONS_TAB_SKELETON_ITEMS,
  collectionsTabFeaturedCarouselHeight,
  type CollectionsTabListItem,
} from '@/constants/collections-tab';
import type { CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';
import { buildCollectionsTabCatalogMap, enrichCollectionsTabDisplayItem } from '@/utils/collections-tab-catalog';
import type { Collection } from '@/types/shopify';
import { prefetchShopCollectionCoverImages } from '@/utils/shop-collection-cover-prefetch';

type Props = {
  cmsItems: CmsCollectionDisplayItem[];
  catalogCollections?: Collection[];
  loading?: boolean;
  ListHeaderComponent?: React.ReactElement | null;
  contentContainerStyle?: object;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshControl?: ReactElement<RefreshControlProps>;
};

export const ShopCollectionsList = forwardRef<FlashListRef<CollectionsTabListItem>, Props>(
  function ShopCollectionsList(
    {
      cmsItems,
      catalogCollections,
      loading = false,
      ListHeaderComponent,
      contentContainerStyle,
      onScroll,
      refreshControl,
    },
    ref,
  ) {
    const { width, height: winH } = useWindowDimensions();
    const carouselHeight = collectionsTabFeaturedCarouselHeight(width);

    const catalogMap = useMemo(
      () => buildCollectionsTabCatalogMap(cmsItems, catalogCollections),
      [catalogCollections, cmsItems],
    );

    const enrichedItems = useMemo(
      () => cmsItems.map((item) => enrichCollectionsTabDisplayItem(item, catalogMap)),
      [catalogMap, cmsItems],
    );

    const listData = useMemo(
      () =>
        loading
          ? COLLECTIONS_TAB_SKELETON_ITEMS
          : buildCollectionsTabListItems(enrichedItems),
      [enrichedItems, loading],
    );

    useEffect(() => {
      if (loading || enrichedItems.length === 0) return;
      prefetchShopCollectionCoverImages(enrichedItems, { screenWidth: width });
    }, [enrichedItems, loading, width]);

    const getItemType = useCallback((item: CollectionsTabListItem) => item.type, []);

    const renderItem = useCallback(
      ({ item }: { item: CollectionsTabListItem }) => {
        if (item.type === 'nav') {
          return <ShopCollectionNavRow item={item.item} loading={loading} />;
        }

        if (item.type === 'section-spacer') {
          return <View style={{ height: COLLECTIONS_TAB_SECTION_SPACER }} />;
        }

        return (
          <View style={{ height: carouselHeight }}>
            <ShopCollectionFeaturedCarousel
              items={item.items}
              screenWidth={width}
              loading={loading}
            />
          </View>
        );
      },
      [carouselHeight, loading, width],
    );

    const keyExtractor = useCallback((item: CollectionsTabListItem) => item.key, []);

    const listExtra = useMemo(
      () => `${loading}:${width}:${enrichedItems.length}:${listData.length}`,
      [enrichedItems.length, listData.length, loading, width],
    );

    return (
      <FlashList
        ref={ref}
        style={{ flex: 1 }}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        ListHeaderComponent={ListHeaderComponent}
        extraData={listExtra}
        drawDistance={Math.max(winH, carouselHeight * 2)}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
        contentContainerStyle={contentContainerStyle}
      />
    );
  },
);
