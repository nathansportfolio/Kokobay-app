import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { LuxuryTabScreenHeader } from '@/components/navigation/luxury-tab-screen-header';
import { ShopCollectionEditorialCard } from '@/components/shop/shop-collection-editorial-card';
import {
  SHOP_COLLECTION_STRIP_GAP,
  SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING,
} from '@/components/shop/shop-collection-layout';
import { CollectionListSkeleton } from '@/components/ui/collection-list-skeleton';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useOptionalBottomTabBarHeight } from '@/hooks/use-optional-bottom-tab-bar-height';
import { useScreenLoadTrace } from '@/hooks/use-screen-load-trace';
import { resetShopTabPerfTrace } from '@/lib/shop-tab-perf-trace';
import { getKokobayWebCollections } from '@/services/kokobay-web/collections-catalog';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { getCollectionsCms } from '@/services/kokobay-web/collections-cms';
import { getCollections } from '@/services/shopify';
import { collectionHandlesMatch } from '@/utils/collection-handles';
import { cmsCollectionTilesToDisplayItems } from '@/utils/cms-collection-tiles';
import type { CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';
import { collectionsWithCoverImage } from '@/utils/collection-text';

const SHOP_SCROLL_CONTENT = {
  flexGrow: 1,
  paddingTop: 8,
  paddingBottom: 48,
  paddingHorizontal: 20,
} as const;

const COLLECTIONS_CMS_STALE_MS = 60 * 60_000;

function CollectionsHeader({ isError = false }: { isError?: boolean }) {
  return (
    <>
      <LuxuryTabScreenHeader title="Collections" />
      {isError ? (
        <Text variant="caption" className="mb-6 font-sans text-[13px] leading-5 text-mist/90">
          We could not refresh the catalog. Leave this tab and return to try again.
        </Text>
      ) : null}
    </>
  );
}

export default function CategoriesScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { width, height: winH } = useWindowDimensions();
  const tabBarHeight = useOptionalBottomTabBarHeight();
  /** Explicit height — flex:1 ScrollView collapses on Android. */
  const scrollHeight = Math.max(320, winH - tabBarHeight);

  useEffect(() => {
    resetShopTabPerfTrace({ routeKey: 'categories-tab' });
  }, []);

  const isWebCatalog = isKokobayWebProductsConfigured();

  const { data: catalogCollections } = useQuery({
    queryKey: ['kokobay', 'api', 'collections'],
    enabled: isWebCatalog,
    queryFn: async () => (await getKokobayWebCollections(500)) ?? [],
    staleTime: 4 * 60_000,
  });

  const {
    data: cmsTiles,
    isPending: cmsPending,
    isError: cmsError,
    isRefetching: cmsRefetching,
  } = useQuery({
    queryKey: ['collections-cms'],
    staleTime: COLLECTIONS_CMS_STALE_MS,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => getCollectionsCms({ signal }),
  });

  const {
    data: fallbackCollections,
    isPending: fallbackPending,
    isRefetching: fallbackRefetching,
  } = useQuery({
    queryKey: ['categories', 'collections'],
    staleTime: 4 * 60_000,
    placeholderData: keepPreviousData,
    enabled: cmsError,
    queryFn: () => getCollections(48),
  });

  const cmsDisplayItems = useMemo(() => {
    if (!cmsTiles?.length) return [];
    return cmsCollectionTilesToDisplayItems(cmsTiles);
  }, [cmsTiles]);

  const fallbackDisplayItems = useMemo(() => {
    if (!cmsError || !fallbackCollections?.length) return [];
    return collectionsWithCoverImage(fallbackCollections).map((collection) => ({
      collection,
      cmsUrl: undefined as string | undefined,
    }));
  }, [cmsError, fallbackCollections]);

  const displayItems = useMemo((): CmsCollectionDisplayItem[] => {
    const items = cmsDisplayItems.length > 0 ? cmsDisplayItems : fallbackDisplayItems;
    if (!catalogCollections?.length) return items;
    return items.map((item) => {
      const hit = catalogCollections.find(
        (c) =>
          c.handle === item.collection.handle ||
          collectionHandlesMatch(c.handle, item.collection.handle),
      );
      if (!hit) return item;
      return {
        ...item,
        collection: {
          ...item.collection,
          description: hit.description ?? item.collection.description,
          descriptionHtml: hit.descriptionHtml ?? item.collection.descriptionHtml,
        },
      };
    });
  }, [catalogCollections, cmsDisplayItems, fallbackDisplayItems]);

  const showCollectionsSkeleton =
    (cmsPending && cmsTiles === undefined) || (cmsError && fallbackPending && fallbackCollections === undefined);

  const showCatalogError = cmsError && !fallbackPending && fallbackCollections !== undefined;

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const { onScroll } = useBindScrollToTop(scrollToTop, !showCollectionsSkeleton);

  const renderBranch = showCollectionsSkeleton
    ? 'skeleton'
    : displayItems.length > 0
      ? 'content'
      : 'empty-caption';

  useScreenLoadTrace({
    screen: 'categories',
    routeKey: 'categories-tab',
    showSkeleton: showCollectionsSkeleton,
    showContent: renderBranch === 'content',
    branch: renderBranch,
    extra: {
      cmsPending,
      cmsError,
      cmsTileCount: cmsTiles?.length ?? 0,
      displayCount: displayItems.length,
      usingFallback: cmsError && fallbackDisplayItems.length > 0,
    },
    queries: [
      {
        key: '["collections-cms"]',
        isPending: cmsPending,
        isFetching: cmsRefetching,
        isError: cmsError,
        dataUndefined: cmsTiles === undefined,
      },
      {
        key: '["categories","collections"]',
        isPending: fallbackPending,
        isFetching: fallbackRefetching,
        isError: false,
        dataUndefined: fallbackCollections === undefined,
      },
    ],
  });

  const collectionCards = useMemo(
    () => (
      <View style={{ gap: SHOP_COLLECTION_STRIP_GAP, marginHorizontal: -20, paddingHorizontal: SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING }}>
        {displayItems.map((item, index) => (
          <ShopCollectionEditorialCard
            key={item.collection.id}
            collection={item.collection}
            cmsUrl={item.cmsUrl}
            variant="strip"
            imagePriority={index < 6 ? 'normal' : 'low'}
            disableImageTransition
            useShopCoverUri={!item.cmsUrl}
            screenWidth={width}
            perfTraceRowIndex={index}
          />
        ))}
      </View>
    ),
    [displayItems, width],
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        ref={scrollRef}
        style={{ height: scrollHeight, backgroundColor: palette.canvas }}
        contentContainerStyle={SHOP_SCROLL_CONTENT}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}>
        <CollectionsHeader isError={showCatalogError && displayItems.length === 0} />
        {showCollectionsSkeleton ? (
          <CollectionListSkeleton layout="strip" />
        ) : displayItems.length === 0 ? (
          <Text variant="caption" className="font-sans text-[13px] leading-5 text-mist/90">
            Collections will appear here once the catalog has loaded.
          </Text>
        ) : (
          collectionCards
        )}
      </ScrollView>
    </View>
  );
}
