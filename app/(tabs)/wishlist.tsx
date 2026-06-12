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
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useWishlist } from '@/contexts/wishlist-context';
import {
  useWishlistProductsQuery,
  type WishlistProductsMap,
} from '@/hooks/use-wishlist-products-query';
import { useOptionalBottomTabBarHeight } from '@/hooks/use-optional-bottom-tab-bar-height';
import { newInCollectionHref } from '@/utils/collection-handles';

/** Horizontal inset — `px-5` luxury breathing room */
const H_PAD = 20;
/** Gap between columns and rows — `gap-5` */
const COL_GAP = 20;
const ROW_GAP = 20;

const LIST_BOTTOM_PAD = 48;

/** Inline shell — NativeWind flex-1 on SafeAreaView / FlashList fails on Android. */
const WISHLIST_SHELL = { flex: 1, backgroundColor: '#FAF8F5' } as const;

function useWishlistGridMetrics() {
  const { width: winW } = useWindowDimensions();
  return useMemo(() => {
    const inner = Math.max(0, winW - H_PAD * 2);
    const tileW = (inner - COL_GAP) / 2;
    /** 3:4 portrait — dominant fashion crop */
    const imageH = Math.round((tileW * 4) / 3);
    const textStack = 58;
    const itemHeight = imageH + textStack;
    const cellHeight = itemHeight + ROW_GAP;
    return { inner, tileW, imageH, itemHeight, cellHeight };
  }, [winW]);
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
  const tabBarHeight = useOptionalBottomTabBarHeight();
  const { tileW, imageH, cellHeight } = useWishlistGridMetrics();
  const { wishlistHandles, wishlistHydrated } = useWishlist();
  const listRef = useRef<FlashListRef<string>>(null);

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
      <>
        <WishlistHeader />
      </>
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
          tileWidth={tileW}
          imageHeight={imageH}
          cellHeight={cellHeight}
          columnGap={COL_GAP}
        />
      );
    },
    [productsByHandle, productsPending, productsFetching, tileW, imageH, cellHeight],
  );

  const keyExtractor = useCallback((handle: string) => handle, []);

  const listExtra = useMemo(
    () => `${tileW}:${imageH}:${cellHeight}:${Object.keys(productsByHandle).length}`,
    [tileW, imageH, cellHeight, productsByHandle],
  );

  const listBottomPad = tabBarHeight + LIST_BOTTOM_PAD;

  if (!wishlistHydrated) {
    return (
      <SafeAreaView style={WISHLIST_SHELL} edges={['left', 'right']}>
        <View style={[WISHLIST_SHELL, { paddingHorizontal: H_PAD, paddingBottom: listBottomPad }]}>
          <WishlistHeader />
          <WishlistGridSkeleton imageHeight={imageH} />
        </View>
      </SafeAreaView>
    );
  }

  if (wishlistHandles.length === 0) {
    return (
      <SafeAreaView style={WISHLIST_SHELL} edges={['left', 'right']}>
        <View style={[WISHLIST_SHELL, { paddingHorizontal: H_PAD, paddingBottom: listBottomPad }]}>
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
      <SafeAreaView style={WISHLIST_SHELL} edges={['left', 'right']}>
        <View style={[WISHLIST_SHELL, { paddingHorizontal: H_PAD, paddingBottom: listBottomPad }]}>
          <WishlistHeader />
          <EmptyState title="Something went wrong" message="We could not load your wishlist. Try again.">
            <Button title="Try again" variant="primary" onPress={() => void refetchProducts()} />
          </EmptyState>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={WISHLIST_SHELL} edges={['left', 'right']}>
      <View style={[WISHLIST_SHELL, { paddingHorizontal: H_PAD }]}>
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
