import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Link, usePathname } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LuxuryTabScreenHeader } from '@/components/navigation/luxury-tab-screen-header';
import { TabScreenTouchRoot } from '@/components/navigation/tab-screen-touch-root';
import { WishlistGridItem } from '@/components/wishlist/wishlist-grid-item';
import { WishlistGridSkeleton } from '@/components/wishlist/wishlist-grid-skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  PLP_COLUMN_GAP,
  PLP_HORIZONTAL_PAD,
  PLP_LIST_BOTTOM_PAD,
  plpScreenShell,
} from '@/constants/plp-scroll';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useWishlist } from '@/contexts/wishlist-context';
import {
  useWishlistProductsQuery,
  type WishlistProductsMap,
} from '@/hooks/use-wishlist-products-query';
import { useScrollBottomPadding } from '@/contexts/chrome-context';
import { newInCollectionHref } from '@/utils/collection-handles';
import { collectionProductCellHeight } from '@/utils/plp-layout';
import { productHref, productReturnToParam } from '@/utils/product-navigation';

/** Empty/error states keep luxury side inset; product grid matches PLP (flush, minimal gap). */
const EMPTY_H_PAD = 20;
const LIST_BOTTOM_PAD = PLP_LIST_BOTTOM_PAD;

function useWishlistGridMetrics(screenWidth: number) {
  return useMemo(() => {
    const contentWidth = screenWidth - PLP_HORIZONTAL_PAD * 2;
    const tileW = Math.floor((contentWidth - PLP_COLUMN_GAP) / 2);
    const cellHeight = collectionProductCellHeight(tileW, 2, { withFooterCta: true });
    return { tileW, cellHeight };
  }, [screenWidth]);
}

function WishlistHeader() {
  return <LuxuryTabScreenHeader title="Wishlist" />;
}

export default function WishlistScreen() {
  return (
    <TabScreenTouchRoot>
      <WishlistScreenContent />
    </TabScreenTouchRoot>
  );
}

function WishlistScreenContent() {
  const pathname = usePathname();
  const { width: screenWidth } = useWindowDimensions();
  const listBottomPad = useScrollBottomPadding(LIST_BOTTOM_PAD);
  const { tileW, cellHeight } = useWishlistGridMetrics(screenWidth);
  const { wishlistHandles, wishlistHydrated } = useWishlist();
  const listRef = useRef<FlashListRef<string>>(null);

  const productLinkFor = useCallback(
    (handle: string) => productHref(handle, productReturnToParam(pathname)),
    [pathname],
  );

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);
  const { onScroll } = useBindScrollToTop(
    scrollToTop,
    wishlistHydrated && wishlistHandles.length > 0,
  );

  const listEnabled = wishlistHydrated && wishlistHandles.length > 0;

  const {
    data: productsByHandle = {} as WishlistProductsMap,
    isPending: productsPending,
    isFetching: productsFetching,
    isError: productsError,
    refetch: refetchProducts,
  } = useWishlistProductsQuery(wishlistHandles, listEnabled);

  const listHeader = useMemo(
    () => (
      <View style={{ paddingHorizontal: EMPTY_H_PAD }}>
        <WishlistHeader />
      </View>
    ),
    [],
  );

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => {
      layout.size = cellHeight;
    },
    [cellHeight],
  );

  const renderItem = useCallback(
    ({ item: handle, index }: { item: string; index: number }) => {
      const product = productsByHandle[handle];
      const isPending = (productsPending || productsFetching) && !product;
      return (
        <WishlistGridItem
          handle={handle}
          product={product}
          isPending={isPending}
          index={index}
          productLink={productLinkFor(handle)}
          tileWidth={tileW}
          cellHeight={cellHeight}
          columnGap={PLP_COLUMN_GAP}
        />
      );
    },
    [productsByHandle, productsPending, productsFetching, tileW, cellHeight, productLinkFor],
  );

  const keyExtractor = useCallback((handle: string) => handle, []);

  const listExtra = useMemo(
    () => `${tileW}:${cellHeight}:${Object.keys(productsByHandle).length}`,
    [tileW, cellHeight, productsByHandle],
  );

  if (!wishlistHydrated) {
    return (
      <SafeAreaView style={plpScreenShell} edges={['left', 'right']}>
        <View style={[plpScreenShell, { paddingBottom: listBottomPad }]}>
          <View style={{ paddingHorizontal: EMPTY_H_PAD }}>
            <WishlistHeader />
          </View>
          <WishlistGridSkeleton
            itemWidth={tileW}
            cellHeight={cellHeight}
            columnGap={PLP_COLUMN_GAP}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (wishlistHandles.length === 0) {
    return (
      <SafeAreaView style={plpScreenShell} edges={['left', 'right']}>
        <View style={[plpScreenShell, { paddingHorizontal: EMPTY_H_PAD, paddingBottom: listBottomPad }]}>
          <WishlistHeader />
          <EmptyState
            title="Your Wishlist is empty"
            message="Tap on the heart icons to add to your wishlist">
            <Link href={newInCollectionHref(pathname)} asChild>
              <Button title="Browse" variant="primary" className="mt-4 px-10" />
            </Link>
          </EmptyState>
        </View>
      </SafeAreaView>
    );
  }

  if (productsError && Object.keys(productsByHandle).length === 0) {
    return (
      <SafeAreaView style={plpScreenShell} edges={['left', 'right']}>
        <View style={[plpScreenShell, { paddingHorizontal: EMPTY_H_PAD, paddingBottom: listBottomPad }]}>
          <WishlistHeader />
          <EmptyState title="Something went wrong" message="We could not load your wishlist. Try again.">
            <Button title="Try again" variant="primary" onPress={() => void refetchProducts()} />
          </EmptyState>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={plpScreenShell} edges={['left', 'right']}>
      <View style={plpScreenShell}>
        <FlashList
          ref={listRef}
          style={{ flex: 1 }}
          data={wishlistHandles}
          numColumns={2}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemType={() => 'wishlistTile'}
          ListHeaderComponent={listHeader}
          drawDistance={Math.max(400, cellHeight * 3)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          overrideItemLayout={overrideItemLayout}
          extraData={listExtra}
          removeClippedSubviews={false}
          contentContainerStyle={{
            paddingBottom: listBottomPad,
          }}
        />
      </View>
    </SafeAreaView>
  );
}
