import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { forwardRef, useCallback, useMemo, type ReactElement } from 'react';
import { View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type RefreshControlProps } from 'react-native';

import { ShopCollectionEditorialCard } from '@/components/shop/shop-collection-editorial-card';
import {
  shopByCategoryStripItemHeight,
  SHOP_COLLECTION_STRIP_GAP,
  SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING,
} from '@/components/shop/shop-collection-layout';
import type { CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';

type Props = {
  items: CmsCollectionDisplayItem[];
  ListHeaderComponent?: React.ReactElement | null;
  contentContainerStyle?: object;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshControl?: ReactElement<RefreshControlProps>;
};

export const ShopCollectionsList = forwardRef<FlashListRef<CmsCollectionDisplayItem>, Props>(
  function ShopCollectionsList(
    { items, ListHeaderComponent, contentContainerStyle, onScroll, refreshControl },
    ref,
  ) {
    const { width, height: winH } = useWindowDimensions();
    const itemHeight = shopByCategoryStripItemHeight();

    const overrideItemLayout = useCallback(
      (layout: { span?: number; size?: number }) => {
        layout.size = itemHeight;
      },
      [itemHeight],
    );

    const renderItem = useCallback(
      ({ item, index }: { item: CmsCollectionDisplayItem; index: number }) => (
        <View
          style={{
            height: itemHeight,
            paddingHorizontal: SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING,
            paddingBottom: SHOP_COLLECTION_STRIP_GAP,
          }}>
          <ShopCollectionEditorialCard
            collection={item.collection}
            cmsUrl={item.cmsUrl}
            variant="strip"
            imagePriority={index < 6 ? 'normal' : 'low'}
            disableImageTransition
            useShopCoverUri={!item.cmsUrl}
            screenWidth={width}
            perfTraceRowIndex={index}
          />
        </View>
      ),
      [itemHeight, width],
    );

    const keyExtractor = useCallback((item: CmsCollectionDisplayItem) => item.collection.id, []);

    const listExtra = useMemo(() => `${itemHeight}:${width}`, [itemHeight, width]);

    return (
      <FlashList
        ref={ref}
        style={{ flex: 1 }}
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        overrideItemLayout={overrideItemLayout}
        extraData={listExtra}
        drawDistance={Math.max(winH, itemHeight * 3)}
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
