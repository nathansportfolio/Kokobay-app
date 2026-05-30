import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { forwardRef, useCallback, useMemo, type ReactElement } from 'react';
import { View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type RefreshControlProps } from 'react-native';

import { ShopCollectionEditorialCard } from '@/components/shop/shop-collection-editorial-card';
import {
  shopByCategoryStripItemHeight,
  SHOP_COLLECTION_STRIP_GAP,
  SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING,
} from '@/components/shop/shop-collection-layout';
import type { Collection } from '@/types/shopify';

type Props = {
  collections: Collection[];
  ListHeaderComponent?: React.ReactElement | null;
  contentContainerStyle?: object;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshControl?: ReactElement<RefreshControlProps>;
};

export const ShopCollectionsList = forwardRef<FlashListRef<Collection>, Props>(
  function ShopCollectionsList(
    { collections, ListHeaderComponent, contentContainerStyle, onScroll, refreshControl },
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
      ({ item, index }: { item: Collection; index: number }) => (
        <View
          style={{
            height: itemHeight,
            paddingHorizontal: SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING,
            paddingBottom: SHOP_COLLECTION_STRIP_GAP,
          }}>
          <ShopCollectionEditorialCard
            collection={item}
            variant="strip"
            imagePriority="low"
            disableImageTransition
            useShopCoverUri
            screenWidth={width}
            perfTraceRowIndex={index}
          />
        </View>
      ),
      [itemHeight, width],
    );

    const keyExtractor = useCallback((item: Collection) => item.id, []);

    const listExtra = useMemo(() => itemHeight, [itemHeight]);

    return (
      <FlashList
        ref={ref}
        style={{ flex: 1 }}
        data={collections}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        overrideItemLayout={overrideItemLayout}
        extraData={listExtra}
        drawDistance={Math.max(winH, itemHeight * 2)}
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
