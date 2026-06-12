import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FlashListRef } from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { LuxuryTabScreenHeader } from '@/components/navigation/luxury-tab-screen-header';
import { TabScreenTouchRoot } from '@/components/navigation/tab-screen-touch-root';
import { ShopCollectionsList } from '@/components/shop/shop-collections-list';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useScrollBottomPadding } from '@/contexts/chrome-context';
import { useScreenLoadTrace } from '@/hooks/use-screen-load-trace';
import { markShopTabViewportExpected, resetShopTabPerfTrace } from '@/lib/shop-tab-perf-trace';
import { getKokobayWebCollections } from '@/services/kokobay-web/collections-catalog';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { getCollectionsCms } from '@/services/kokobay-web/collections-cms';
import { getCollections } from '@/services/shopify';
import { canonicalCollectionHandle } from '@/utils/collection-handles';
import { cmsCollectionTilesToDisplayItems } from '@/utils/cms-collection-tiles';
import type { CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';
import { collectionsWithCoverImage } from '@/utils/collection-text';
import { prefetchShopCollectionCoverImages } from '@/utils/shop-collection-cover-prefetch';

const LIST_BOTTOM_PAD = 48;

const HEADER_WRAP = {
  paddingTop: 8,
  paddingHorizontal: 20,
} as const;

const COLLECTIONS_CMS_STALE_MS = 60 * 60_000;

const CATEGORIES_SHELL = { flex: 1, backgroundColor: palette.canvas } as const;

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
  return (
    <TabScreenTouchRoot>
      <CategoriesScreenContent />
    </TabScreenTouchRoot>
  );
}

function CategoriesScreenContent() {
  const listRef = useRef<FlashListRef<CmsCollectionDisplayItem>>(null);
  const { width: screenWidth } = useWindowDimensions();
  const listBottomPad = useScrollBottomPadding(LIST_BOTTOM_PAD);

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

  const catalogByCanonical = useMemo(() => {
    if (!catalogCollections?.length) return null;
    const map = new Map<string, (typeof catalogCollections)[number]>();
    for (const c of catalogCollections) {
      map.set(canonicalCollectionHandle(c.handle), c);
    }
    return map;
  }, [catalogCollections]);

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
    if (!catalogByCanonical) return items;
    return items.map((item) => {
      const hit = catalogByCanonical.get(canonicalCollectionHandle(item.collection.handle));
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
  }, [catalogByCanonical, cmsDisplayItems, fallbackDisplayItems]);

  const showCollectionsSkeleton =
    (cmsPending && cmsTiles === undefined) || (cmsError && fallbackPending && fallbackCollections === undefined);

  const showCatalogError = cmsError && !fallbackPending && fallbackCollections !== undefined;

  useEffect(() => {
    if (showCollectionsSkeleton || displayItems.length === 0) return;
    const prefetched = prefetchShopCollectionCoverImages(displayItems, { screenWidth });
    markShopTabViewportExpected(prefetched);
  }, [displayItems, screenWidth, showCollectionsSkeleton]);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const listEnabled = showCollectionsSkeleton || displayItems.length > 0;
  const { onScroll } = useBindScrollToTop(scrollToTop, listEnabled);

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

  const listHeader = useMemo(
    () => (
      <View style={HEADER_WRAP}>
        <CollectionsHeader isError={showCatalogError && displayItems.length === 0} />
      </View>
    ),
    [displayItems.length, showCatalogError],
  );

  if (!showCollectionsSkeleton && displayItems.length === 0) {
    return (
      <View style={CATEGORIES_SHELL}>
        <View style={[HEADER_WRAP, { paddingBottom: listBottomPad }]}>
          <CollectionsHeader isError={showCatalogError} />
          <Text variant="caption" className="font-sans text-[13px] leading-5 text-mist/90">
            Collections will appear here once the catalog has loaded.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={CATEGORIES_SHELL}>
      <ShopCollectionsList
        ref={listRef}
        loading={showCollectionsSkeleton}
        items={displayItems}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: listBottomPad }}
        onScroll={onScroll}
      />
    </View>
  );
}
