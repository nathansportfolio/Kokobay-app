import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useQueries } from '@tanstack/react-query';
import { Link, usePathname } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LuxuryTabScreenHeader } from '@/components/navigation/luxury-tab-screen-header';
import { WishlistGridSkeleton } from '@/components/wishlist/wishlist-grid-skeleton';
import { WishlistSavedCard } from '@/components/wishlist/wishlist-saved-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useShopLists } from '@/contexts/shop-lists-context';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { useOptionalBottomTabBarHeight } from '@/hooks/use-optional-bottom-tab-bar-height';
import { getProduct } from '@/services/shopify';
import { newInCollectionHref } from '@/utils/collection-handles';
import {
  PRODUCT_QUERY_GC_TIME_MS,
  PRODUCT_QUERY_STALE_TIME_MS,
} from '@/constants/product-query';
import { productQueryKey } from '@/utils/product-query-key';

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
    return { inner, tileW, imageH, itemHeight };
  }, [winW]);
}

function WishlistHeader() {
  return <LuxuryTabScreenHeader title="Wishlist" />;
}

export default function WishlistScreen() {
  const pathname = usePathname();
  const tabBarHeight = useOptionalBottomTabBarHeight();
  const marketKey = useMarketQueryKey();
  const { tileW, imageH, itemHeight } = useWishlistGridMetrics();
  const { wishlistHandles, wishlistHydrated, toggleWishlist } = useShopLists();
  const listRef = useRef<FlashListRef<string>>(null);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);
  const { onScroll } = useBindScrollToTop(
    scrollToTop,
    wishlistHydrated && wishlistHandles.length > 0,
  );

  const productQueries = useQueries({
    queries: wishlistHandles.map((handle) => ({
      queryKey: productQueryKey(handle, marketKey),
      queryFn: ({ signal }) => getProduct(handle, { signal }),
      staleTime: PRODUCT_QUERY_STALE_TIME_MS,
      gcTime: PRODUCT_QUERY_GC_TIME_MS,
      enabled: wishlistHydrated && wishlistHandles.length > 0,
    })),
  });

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
      layout.size = itemHeight;
    },
    [itemHeight],
  );

  const renderItem = useCallback(
    ({ item: handle, index }: { item: string; index: number }) => {
      const q = productQueries[index];
      return (
        <View
          style={{
            flex: 1,
            maxWidth: '50%',
            paddingRight: index % 2 === 0 ? COL_GAP / 2 : 0,
            paddingLeft: index % 2 === 1 ? COL_GAP / 2 : 0,
            marginBottom: ROW_GAP,
          }}>
          <WishlistSavedCard
            handle={handle}
            product={q?.data ?? undefined}
            isPending={Boolean(q?.isPending)}
            index={index}
            tileWidth={tileW}
            imageHeight={imageH}
            onRemove={() => toggleWishlist(handle)}
          />
        </View>
      );
    },
    [productQueries, toggleWishlist, tileW, imageH],
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

  return (
    <SafeAreaView style={WISHLIST_SHELL} edges={['left', 'right']}>
      <View style={[WISHLIST_SHELL, { paddingHorizontal: H_PAD }]}>
        <FlashList
          ref={listRef}
          style={{ flex: 1 }}
          data={wishlistHandles}
          numColumns={2}
          keyExtractor={(h) => h}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          drawDistance={440}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          overrideItemLayout={overrideItemLayout}
          extraData={itemHeight}
          removeClippedSubviews={false}
          contentContainerStyle={{
            paddingBottom: listBottomPad,
          }}
        />
      </View>
    </SafeAreaView>
  );
}
