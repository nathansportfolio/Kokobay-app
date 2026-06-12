import { useQuery } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeNewInHero, homeNewInHeroHeight } from '@/components/home/home-new-in-hero';
import { HomeNewInSection } from '@/components/home/home-new-in-section';
import { HomeScreenEntrance } from '@/components/home/home-screen-entrance';
import { HomeShopByCategory } from '@/components/home/home-shop-by-category';
import { TabScreenTouchRoot } from '@/components/navigation/tab-screen-touch-root';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ALL_PRODUCTS_COLLECTION_HANDLE } from '@/constants/catalog';
import { isAndroidDevClient } from '@/lib/dev-android-network';
import { luxuryHeaderTotalHeight } from '@/constants/luxury-nav';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useAppErrorBannerChromeHeight } from '@/hooks/use-app-error-banner-content';
import { useAppHomeHeroQuery } from '@/hooks/use-app-home-hero-query';
import { useHomeRenderTrace } from '@/hooks/use-home-render-trace';
import { useLifecycleRenderCount } from '@/hooks/use-lifecycle-render-count';
import { useRenderTrace } from '@/hooks/use-render-trace';
import { useHomeCatalogQuery } from '@/hooks/use-home-catalog-query';
import { getCollectionsCms } from '@/services/kokobay-web/collections-cms';
import { HOME_NEW_IN_CAROUSEL_LIMIT, HOME_SHOP_BY_CATEGORY_LIMIT } from '@/services/home-catalog';
import { collectionHref } from '@/utils/collection-navigation';
import { resolveHomeNewInCollectionHandle } from '@/utils/home-new-in-collection-handle';
import type { Collection } from '@/types/shopify';
import { cmsCollectionTilesToDisplayItems, type CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';
import { collectionsWithCoverImage } from '@/utils/collection-text';
import { orderCollectionsForDisplay } from '@/utils/order-collections';

const COLLECTIONS_CMS_STALE_MS = 60 * 60_000;

const SHOP_BY_CATEGORY_TOP = 56;

function orderHomeCollections(collections: Collection[]): Collection[] {
  return collectionsWithCoverImage(
    orderCollectionsForDisplay(collections, {
      excludeHandles: [ALL_PRODUCTS_COLLECTION_HANDLE],
    }),
  );
}

function homeCollectionFallbackItems(collections: Collection[]): CmsCollectionDisplayItem[] {
  return orderHomeCollections(collections)
    .slice(0, HOME_SHOP_BY_CATEGORY_LIMIT)
    .map((collection) => ({ collection, cmsUrl: undefined }));
}

export default function HomeScreen() {
  return (
    <TabScreenTouchRoot>
      <HomeScreenContent />
    </TabScreenTouchRoot>
  );
}

function HomeScreenContent() {
  useLifecycleRenderCount('home');
  useRenderTrace('Home');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const mainScrollRef = useRef<ScrollView>(null);
  const loadingScrollRef = useRef<ScrollView>(null);
  const scrollToTopMain = useCallback(() => {
    mainScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const scrollToTopLoading = useCallback(() => {
    loadingScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const appErrorBannerHeight = useAppErrorBannerChromeHeight();
  const headerStack = luxuryHeaderTotalHeight(insets.top, appErrorBannerHeight);
  const tileWidth = Math.min(280, Math.round(width * 0.78));
  const carouselHeight = tileWidth * (4 / 3) + 100;
  const heroQuery = useAppHomeHeroQuery();
  const newInHandle = useMemo(
    () => resolveHomeNewInCollectionHandle(heroQuery.data?.buttonLink),
    [heroQuery.data?.buttonLink],
  );
  const viewAllHref = useMemo(
    () => collectionHref(newInHandle) as Href,
    [newInHandle],
  );

  const { data, isPending, isError, refetch, isRefetching, isFetching } = useHomeCatalogQuery();
  const showHomeSkeleton =
    data === undefined && (isPending || isFetching || isRefetching);

  const { data: cmsTiles } = useQuery({
    queryKey: ['collections-cms'],
    staleTime: COLLECTIONS_CMS_STALE_MS,
    queryFn: ({ signal }) => getCollectionsCms({ signal }),
  });

  useHomeRenderTrace({
    isPending,
    isError,
    hasData: Boolean(data),
    isRefetching,
    cmsTilesCount: cmsTiles?.length ?? 0,
    appErrorBannerHeight,
    width,
    newInHandle,
    heroPending: heroQuery.isPending,
  });

  const { onScroll: onScrollLoading } = useBindScrollToTop(scrollToTopLoading, showHomeSkeleton);
  const { onScroll: onScrollMain } = useBindScrollToTop(
    scrollToTopMain,
    !showHomeSkeleton && !isError && Boolean(data),
  );

  const newInProducts = useMemo(
    () => (data ? data.newIn.slice(0, HOME_NEW_IN_CAROUSEL_LIMIT) : []),
    [data],
  );

  const shopByCategoryItems = useMemo((): CmsCollectionDisplayItem[] => {
    if (cmsTiles?.length) {
      return cmsCollectionTilesToDisplayItems(
        cmsTiles.slice(0, HOME_SHOP_BY_CATEGORY_LIMIT),
      );
    }
    if (!data) return [];
    return homeCollectionFallbackItems(data.collections);
  }, [cmsTiles, data]);

  if (showHomeSkeleton) {
    return (
      <View className="flex-1 bg-canvas">
        <ScrollView
          ref={loadingScrollRef}
          className="flex-1"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          onScroll={onScrollLoading}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 48, paddingTop: 0 }}>
          <Skeleton
            className="mb-0 w-full rounded-none"
            style={{ height: homeNewInHeroHeight(width), borderRadius: 0 }}
          />
          <View className="px-5 pt-6">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="mb-8 h-8 w-[55%]" />
            <Skeleton className="mb-4 h-36 w-full" />
            <Skeleton className="mb-10 h-28 w-full" />
            <Skeleton className="mb-3 h-3 w-28" />
            <Skeleton className="h-24 w-full" />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (isError || !data) {
    const connectionMessage =
      __DEV__ && isAndroidDevClient()
        ? 'The Android emulator often cannot reach external APIs (timeouts). Try a physical device, cold-boot the emulator, or use EXPO_PUBLIC_KOKOBAY_USE_LOCALHOST=true with http://10.0.2.2:3000.'
        : 'We could not reach the catalog. Check your connection and try again.';

    return (
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ flexGrow: 1, paddingTop: headerStack, paddingBottom: 48 }}>
        <View className="px-5">
          <EmptyState title="The bay is quiet" message={connectionMessage} />
          <Button
            title={isRefetching ? 'Refreshing…' : 'Retry'}
            variant="secondary"
            disabled={isRefetching}
            onPress={() => refetch()}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <HomeScreenEntrance>
      <ScrollView
        ref={mainScrollRef}
        className="flex-1 bg-canvas"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        onScroll={onScrollMain}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <HomeNewInHero width={width} />
        <View style={{ paddingTop: 24 }}>
          <HomeNewInSection
            products={newInProducts}
            tileWidth={tileWidth}
            carouselHeight={carouselHeight}
            viewAllHref={viewAllHref}
          />
        </View>
        <View style={{ paddingTop: SHOP_BY_CATEGORY_TOP }}>
          <HomeShopByCategory
            items={shopByCategoryItems}
            staggerRowEntrance={false}
            showViewAllCollections
            cardLayout="strip"
            screenWidth={width}
          />
        </View>
      </ScrollView>
    </HomeScreenEntrance>
  );
}
