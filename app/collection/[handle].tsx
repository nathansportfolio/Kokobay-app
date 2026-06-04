import { useNavigation } from '@react-navigation/native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionPlpFilterModal } from '@/components/plp/collection-plp-filter-modal';
import { CollectionPlpSortModal } from '@/components/plp/collection-plp-sort-modal';
import { CollectionPlpToolbar } from '@/components/plp/collection-plp-toolbar';
import { CollectionProductTile } from '@/components/plp/collection-product-tile';
import { PlpInfiniteScrollFooter } from '@/components/plp/plp-infinite-scroll-footer';
import { PlpNoResultsSuggestions } from '@/components/plp/plp-no-results-suggestions';
import { PlpProductCountLabel } from '@/components/plp/plp-product-count-label';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProductGridSkeleton } from '@/components/ui/product-grid-skeleton';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { luxuryChrome } from '@/constants/luxury-nav';
import { useLuxuryPlpListHeaderPaddingTop } from '@/hooks/use-luxury-chrome-top-padding';
import { useAppErrorBannerChromeHeight } from '@/hooks/use-app-error-banner-content';
import {
  PLP_COLUMN_GAP,
  PLP_HORIZONTAL_PAD,
  PLP_LIST_BOTTOM_PAD,
  PLP_MAINTAIN_VISIBLE_CONTENT_POSITION,
  plpScreenShell,
} from '@/constants/plp-scroll';
import { ALL_PRODUCTS_COLLECTION, ALL_PRODUCTS_COLLECTION_HANDLE } from '@/constants/catalog';
import { palette } from '@/constants/theme';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useKokobayPlpEndReached } from '@/hooks/use-kokobay-plp-end-reached';
import { useCollectionPlpRenderTrace } from '@/hooks/use-collection-plp-render-trace';
import { useRenderTrace } from '@/hooks/use-render-trace';
import { useKokobayCatalogQueryCleanup } from '@/hooks/use-kokobay-catalog-query-cleanup';
import { useKokobayCollectionCatalog } from '@/hooks/use-kokobay-catalog-pages';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { useOptionalBottomTabBarHeight } from '@/hooks/use-optional-bottom-tab-bar-height';
import { usePlpDisplayProducts } from '@/hooks/use-plp-display-products';
import { usePlpScrollToTop } from '@/hooks/use-plp-scroll-to-top';
import { usePlpScrollOffsetTrace } from '@/hooks/use-plp-scroll-offset-trace';
import { useReturnToGoBack } from '@/hooks/use-return-to-go-back';
import { useScreenLoadTrace } from '@/hooks/use-screen-load-trace';
import { useStableTopInset } from '@/hooks/use-stable-top-inset';
import { resetPlpPerfTrace } from '@/lib/plp-perf-trace';
import { resetPlpScrollDebug } from '@/lib/plp-scroll-debug';
import { trackViewItemList } from '@/lib/gtm';
import { getKokobayWebCollections } from '@/services/kokobay-web/collections-catalog';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { getCollectionProducts } from '@/services/shopify';
import { showToast, useMarketStore } from '@/store';
import { defaultPlpFilters, type PlpFilters, type PlpSort } from '@/types/plp';
import type { Collection, Product } from '@/types/shopify';
import {
  countActivePlpFilters,
  extractFacets,
  normalizePlpPriceRangeForDraft,
  plpPriceSliderMetaForCurrency,
} from '@/utils/plp';
import { collectionHandlesMatch, resolveCollectionHandleForApi } from '@/utils/collection-handles';
import { navigateToHomeTab } from '@/utils/collection-navigation';
import { collectionBlurb, collectionEditorialEyebrow } from '@/utils/collection-text';
import { collectionProductCellHeight } from '@/utils/plp-layout';
import { keepPreviousDataForQueryKeyMatch } from '@/utils/react-query-placeholder';
import { hasActivePlpFilters } from '@/utils/storefront-filters';

export default function CollectionScreen() {
  useRenderTrace('Collection');
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const goBack = useReturnToGoBack();
  const topInset = useStableTopInset();
  const appErrorBannerHeight = useAppErrorBannerChromeHeight();
  const listHeaderPaddingTop = useLuxuryPlpListHeaderPaddingTop(appErrorBannerHeight);
  const tabBarHeight = useOptionalBottomTabBarHeight();
  const { width } = useWindowDimensions();
  const safeHandle = typeof handle === 'string' ? handle : '';
  const apiHandle = resolveCollectionHandleForApi(safeHandle);
  const isWebCatalog = isKokobayWebProductsConfigured();

  const { data: kokobayCollectionIndex, isFetching: collectionIndexFetching } = useQuery({
    queryKey: ['kokobay', 'api', 'collections'],
    enabled: isWebCatalog && Boolean(safeHandle),
    queryFn: async () => (await getKokobayWebCollections(500)) ?? [],
    staleTime: 4 * 60_000,
  });

  const [filters, setFilters] = useState<PlpFilters>(defaultPlpFilters);
  const [sort, setSort] = useState<PlpSort>('featured');
  const [numColumns, setNumColumns] = useState<1 | 2>(2);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const listRef = useRef<FlashListRef<Product>>(null);
  const emptyCollectionHandledRef = useRef(false);

  const horizontalPad = PLP_HORIZONTAL_PAD;
  const columnGap = PLP_COLUMN_GAP;
  const contentWidth = width - horizontalPad * 2;
  const itemWidth =
    numColumns === 1 ? contentWidth : Math.floor((contentWidth - columnGap) / numColumns);

  const cellHeight = useMemo(
    () => collectionProductCellHeight(itemWidth, numColumns),
    [itemWidth, numColumns],
  );

  useKokobayCatalogQueryCleanup('collection');

  const kokobayCatalog = useKokobayCollectionCatalog(apiHandle, isWebCatalog, {
    plpFilters: filters,
    sort,
  });

  const collection = useMemo(() => {
    if (!safeHandle) return undefined;

    let base: Collection | undefined;
    if (kokobayCollectionIndex?.length) {
      const hit = kokobayCollectionIndex.find(
        (c) => c.handle === safeHandle || collectionHandlesMatch(c.handle, safeHandle),
      );
      if (hit) base = hit;
    }
    if (!base) {
      if (safeHandle === ALL_PRODUCTS_COLLECTION_HANDLE || apiHandle === ALL_PRODUCTS_COLLECTION_HANDLE) {
        base = ALL_PRODUCTS_COLLECTION;
      } else {
        base = {
          id: `collection:${safeHandle}`,
          handle: safeHandle,
          title: collectionEditorialEyebrow(safeHandle),
          image: null,
        };
      }
    }

    const fromCatalog = isWebCatalog ? kokobayCatalog.collectionSummary : null;
    if (!fromCatalog) return base;

    return {
      ...base,
      id: fromCatalog.id || base.id,
      handle: fromCatalog.handle || base.handle,
      title: fromCatalog.title?.trim() || base.title,
      description: fromCatalog.description ?? base.description,
      descriptionHtml: fromCatalog.descriptionHtml ?? base.descriptionHtml,
      image: fromCatalog.image ?? base.image,
    };
  }, [
    safeHandle,
    apiHandle,
    kokobayCollectionIndex,
    isWebCatalog,
    kokobayCatalog.collectionSummary,
  ]);

  const collectionBlurbText = useMemo(
    () => (collection ? collectionBlurb(collection) : undefined),
    [collection],
  );

  const marketKey = useMarketQueryKey();
  const marketCurrency = useMarketStore((s) => s.currencyCode);

  const {
    data: legacyAllProducts,
    isPending: legacyCatalogPending,
    isError: legacyCatalogError,
    isRefetching: legacyCatalogRefetching,
    refetch: refetchLegacyCatalog,
    dataUpdatedAt: legacyCatalogDataUpdatedAt,
  } = useQuery({
    queryKey: ['collection', 'products', safeHandle, marketKey],
    enabled: Boolean(safeHandle) && !isWebCatalog,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousDataForQueryKeyMatch<
      Product[],
      readonly ['collection', 'products', string, string]
    >(2, safeHandle),
    queryFn: async () => {
      if (!safeHandle) return [];
      return getCollectionProducts(safeHandle);
    },
  });

  const allProducts = isWebCatalog ? kokobayCatalog.products : legacyAllProducts;
  const catalogPending = isWebCatalog ? kokobayCatalog.isPending : legacyCatalogPending;
  const catalogError = isWebCatalog ? kokobayCatalog.isError : legacyCatalogError;
  const catalogRefetching = isWebCatalog ? kokobayCatalog.isRefetching : legacyCatalogRefetching;
  const catalogRefetch = isWebCatalog ? kokobayCatalog.refetch : refetchLegacyCatalog;

  const priceMeta = useMemo(
    () => plpPriceSliderMetaForCurrency(marketCurrency),
    [marketCurrency],
  );

  const facets = useMemo(() => {
    if (isWebCatalog) return kokobayCatalog.filterFacets;
    return extractFacets(allProducts ?? []);
  }, [isWebCatalog, kokobayCatalog.filterFacets, allProducts]);

  const serverSideFiltersActive =
    isWebCatalog &&
    hasActivePlpFilters(filters, priceMeta.min, priceMeta.max) &&
    kokobayCatalog.serverSideFiltersCapable;
  const hasSelectedFilters = countActivePlpFilters(filters, priceMeta.min, priceMeta.max) > 0;

  const { rows: flatItems, totalFiltered } = usePlpDisplayProducts(allProducts, filters, sort, {
    skipClientFilters: serverSideFiltersActive,
  });

  const plpTraceReason = useMemo(() => {
    const parts: string[] = [];
    if (hasSelectedFilters) parts.push('filters');
    if (sort !== 'featured') parts.push('sort');
    if (catalogPending) parts.push('catalog_pending');
    if (catalogRefetching) parts.push('catalog_refetching');
    if (isWebCatalog) parts.push('web_catalog');
    else parts.push('legacy_catalog');
    return parts.length ? parts.join('+') : 'stable';
  }, [hasSelectedFilters, sort, catalogPending, catalogRefetching, isWebCatalog]);

  const catalogDataUpdatedAt = isWebCatalog
    ? kokobayCatalog.dataUpdatedAt
    : legacyCatalogDataUpdatedAt;

  useCollectionPlpRenderTrace({
    screen: 'collection',
    allProducts,
    flatItems,
    queryDataUpdatedAt: catalogDataUpdatedAt,
    isFetching: catalogRefetching,
    reason: plpTraceReason,
  });

  const displayProductCount =
    isWebCatalog && kokobayCatalog.totalProductCount != null
      ? kokobayCatalog.totalProductCount
      : totalFiltered;

  const onEndReached = useKokobayPlpEndReached({
    screen: 'collection',
    enabled: isWebCatalog,
    hasNextPage: kokobayCatalog.hasNextPage,
    isFetchingNextPage: kokobayCatalog.isFetchingNextPage,
    fetchNextPage: kokobayCatalog.fetchNextPage,
    itemCount: flatItems.length,
  });

  const { chainScrollHandler } = usePlpScrollOffsetTrace({
    screen: 'collection',
    itemCount: flatItems.length,
    isFetchingNextPage: kokobayCatalog.isFetchingNextPage,
  });

  const catalogQueryFetching =
    isWebCatalog && kokobayCatalog.isFetching && !kokobayCatalog.isFetchingNextPage;

  const listLoading =
    !hasSelectedFilters && (catalogPending || allProducts === undefined);

  const showPlpSkeleton =
    flatItems.length === 0 && (listLoading || catalogQueryFetching);

  const plpScrollEnabled = Boolean(
    collection &&
      !catalogError &&
      (hasSelectedFilters || !(allProducts !== undefined && allProducts.length === 0)),
  );

  const scrollToTopPlp = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);
  const { onScroll: onCollectionScroll } = useBindScrollToTop(scrollToTopPlp, plpScrollEnabled);
  const onPlpScroll = useMemo(
    () => chainScrollHandler(onCollectionScroll),
    [chainScrollHandler, onCollectionScroll],
  );

  useEffect(() => {
    setFilters(defaultPlpFilters);
    setSort('featured');
  }, [safeHandle]);

  useEffect(() => {
    resetPlpPerfTrace('collection', { handle: safeHandle });
    resetPlpScrollDebug('collection');
    emptyCollectionHandledRef.current = false;
  }, [safeHandle]);

  const catalogFetchDone = isWebCatalog
    ? !kokobayCatalog.isPending &&
      (kokobayCatalog.isSuccess || kokobayCatalog.isError) &&
      !kokobayCatalog.isFetching
    : !legacyCatalogPending && !legacyCatalogRefetching && legacyAllProducts !== undefined;

  const isEmptyCollection =
    Boolean(collection) &&
    catalogFetchDone &&
    !catalogError &&
    !hasSelectedFilters &&
    flatItems.length === 0 &&
    (allProducts === undefined || allProducts.length === 0);

  useLayoutEffect(() => {
    if (!isEmptyCollection || emptyCollectionHandledRef.current) return;
    emptyCollectionHandledRef.current = true;
    showToast({ variant: 'info', title: 'No products in that collection' });
    navigateToHomeTab(router);
  }, [isEmptyCollection, router]);

  const viewListTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (listLoading || flatItems.length === 0 || !safeHandle) return;
    const listKey = `${safeHandle}::${flatItems.length}`;
    if (viewListTrackedRef.current === listKey) return;
    viewListTrackedRef.current = listKey;
    trackViewItemList({
      listId: safeHandle,
      listName: collection?.title ?? safeHandle,
      products: flatItems,
      currency: marketCurrency,
    });
  }, [collection?.title, flatItems, listLoading, marketCurrency, safeHandle]);

  usePlpScrollToTop(listRef, {
    sort,
    filters,
    scopeKey: safeHandle,
    dataEpoch: catalogDataUpdatedAt,
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false, title: collection?.title ?? '' });
    return () => {
      navigation.setOptions({ headerShown: true });
    };
  }, [navigation, collection?.title]);

  const openFilter = useCallback(() => setFilterOpen(true), []);

  const updateFiltersLive = useCallback(
    (next: PlpFilters) => {
      const { priceMin, priceMax } = normalizePlpPriceRangeForDraft(
        next.priceMin,
        next.priceMax,
        priceMeta.min,
        priceMeta.max,
      );
      setFilters({ ...next, priceMin, priceMax });
    },
    [priceMeta.min, priceMeta.max],
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultPlpFilters);
    setFilterOpen(false);
  }, []);

  const toggleGrid = useCallback(() => {
    setNumColumns((n) => (n === 2 ? 1 : 2));
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Product; index: number }) => (
      <CollectionProductTile
        product={item}
        itemWidth={itemWidth}
        cellHeight={cellHeight}
        numColumns={numColumns}
        tileIndex={index}
        columnGap={columnGap}
        perfTraceIndex={index}
        perfTraceScreen="collection"
      />
    ),
    [itemWidth, cellHeight, numColumns, columnGap],
  );

  const keyExtractor = useCallback((item: Product) => item.id, []);

  const listExtra = useMemo(
    () => `${itemWidth}:${cellHeight}:${numColumns}:${sort}`,
    [itemWidth, cellHeight, numColumns, sort],
  );

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => {
      layout.size = cellHeight;
    },
    [cellHeight],
  );

  const listHeader = useMemo(() => {
    if (!collection) return null;
    return (
      <View style={{ marginHorizontal: -horizontalPad }}>
        <View style={{ height: topInset + listHeaderPaddingTop }} />
        <View
          style={{
            paddingBottom: 14,
            backgroundColor: luxuryChrome.bg,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: luxuryChrome.line,
          }}>
          <View className="relative min-h-[48px] items-center justify-center px-14">
            <Pressable
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={14}
              className="absolute bottom-0 left-4 top-0 z-10 justify-center p-1 active:opacity-70">
              <IconSymbol name="chevron.left" size={18} color={palette.ink} />
            </Pressable>
            <View className="items-center px-2">
              <Text
                variant="body"
                className="text-center font-sans text-[13px] font-normal leading-5 tracking-wide"
                numberOfLines={2}
                style={{ color: palette.ink }}>
                {collection.title}
              </Text>
              {collectionBlurbText ? (
                <Text
                  variant="caption"
                  className="mt-2 text-center font-sans text-[12px] leading-[18px]"
                  numberOfLines={3}
                  style={{ color: 'rgba(120, 118, 114, 0.9)' }}>
                  {collectionBlurbText}
                </Text>
              ) : null}
              <PlpProductCountLabel
                count={displayProductCount}
                visible={allProducts !== undefined}
              />
            </View>
          </View>
        </View>
        <CollectionPlpToolbar
          onFilterPress={openFilter}
          onSortPress={() => setSortOpen(true)}
          onGridToggle={toggleGrid}
          numColumns={numColumns}
          activeFilterCount={countActivePlpFilters(filters, priceMeta.min, priceMeta.max)}
        />
      </View>
    );
  }, [
    collection,
    collectionBlurbText,
    goBack,
    openFilter,
    toggleGrid,
    numColumns,
    filters,
    horizontalPad,
    priceMeta.max,
    priceMeta.min,
    topInset,
    displayProductCount,
    allProducts,
  ]);

  const listEmpty = useMemo(() => {
    if (totalFiltered === 0 && (hasSelectedFilters || (allProducts?.length ?? 0) > 0)) {
      return (
        <PlpNoResultsSuggestions
          variant="filtered"
          onClearFilters={clearFilters}
          excludeHandles={safeHandle && safeHandle !== ALL_PRODUCTS_COLLECTION_HANDLE ? [safeHandle] : []}
        />
      );
    }
    return null;
  }, [totalFiltered, allProducts?.length, hasSelectedFilters, clearFilters, safeHandle]);

  const listFooter = useMemo(() => {
    if (!isWebCatalog) return null;
    return <PlpInfiniteScrollFooter visible={kokobayCatalog.isFetchingNextPage} />;
  }, [isWebCatalog, kokobayCatalog.isFetchingNextPage]);

  let renderBranch = 'content';
  if (!collection) renderBranch = 'not-found';
  else if (catalogError && flatItems.length === 0) renderBranch = 'error';
  else if (showPlpSkeleton) renderBranch = 'skeleton';
  else if (!catalogPending && allProducts !== undefined && allProducts.length === 0 && !hasSelectedFilters) {
    renderBranch = 'empty';
  }

  useScreenLoadTrace({
    screen: 'collection',
    routeKey: safeHandle || 'missing-handle',
    showSkeleton: renderBranch === 'skeleton',
    showContent: renderBranch === 'content',
    branch: renderBranch,
    extra: {
      isWebCatalog,
      listLoading,
      showPlpSkeleton,
      catalogQueryFetching,
      flatItemsCount: flatItems.length,
      allProductsUndefined: allProducts === undefined,
      catalogPending,
    },
    queries: [
      {
        key: '["kokobay","api","collections"]',
        isPending: collectionIndexFetching && kokobayCollectionIndex === undefined,
        isFetching: collectionIndexFetching,
        isError: false,
        dataUndefined: kokobayCollectionIndex === undefined,
        enabled: isWebCatalog && Boolean(safeHandle),
      },
      isWebCatalog
        ? {
            key: `["kokobay","collection-products","${apiHandle}"]`,
            isPending: kokobayCatalog.isPending,
            isFetching: kokobayCatalog.isFetching,
            isError: kokobayCatalog.isError,
            dataUndefined: kokobayCatalog.products === undefined,
            enabled: Boolean(apiHandle),
          }
        : {
            key: `["collection","products","${safeHandle}"]`,
            isPending: legacyCatalogPending,
            isFetching: catalogRefetching,
            isError: catalogError,
            dataUndefined: legacyAllProducts === undefined,
            enabled: Boolean(safeHandle) && !isWebCatalog,
          },
    ],
  });

  if (!collection) {
    return (
      <Screen scroll>
        <EmptyState
          title="Collection not found"
          message={`We do not have a story for “${String(handle)}”. Choose a collection from the Collections tab.`}
        />
      </Screen>
    );
  }

  if (catalogError && flatItems.length === 0) {
    return (
      <Screen scroll>
        <EmptyState title="Something went wrong" message="We could not load this collection. Try again.">
          <Button title="Try again" variant="primary" onPress={() => void catalogRefetch()} />
        </EmptyState>
      </Screen>
    );
  }

  const listBottomPad = tabBarHeight + PLP_LIST_BOTTOM_PAD;

  if (showPlpSkeleton) {
    return (
      <SafeAreaView style={plpScreenShell} edges={['left', 'right']}>
        <ScrollView
          style={plpScreenShell}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: horizontalPad,
            paddingBottom: listBottomPad,
          }}>
          {listHeader}
          <ProductGridSkeleton
              columns={numColumns}
              rows={numColumns === 2 ? 4 : 3}
              itemWidth={itemWidth}
              cellHeight={cellHeight}
              columnGap={columnGap}
            />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isEmptyCollection) {
    return null;
  }

  return (
    <SafeAreaView style={plpScreenShell} collapsable={false} edges={['left', 'right']}>
      <FlashList<Product>
        ref={listRef}
        style={plpScreenShell}
        key={`${safeHandle}-${numColumns}-${sort}`}
        data={flatItems}
        numColumns={numColumns}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemType={() => 'productTile'}
        overrideItemLayout={overrideItemLayout}
        extraData={listExtra}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        drawDistance={Math.max(400, cellHeight * 3)}
        removeClippedSubviews={false}
        {...(PLP_MAINTAIN_VISIBLE_CONTENT_POSITION
          ? { maintainVisibleContentPosition: { autoscrollToBottomThreshold: 0.2 } }
          : {})}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        onScroll={onPlpScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: horizontalPad,
          paddingBottom: listBottomPad,
        }}
        showsVerticalScrollIndicator={false}
      />
      <CollectionPlpFilterModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        draft={filters}
        onChangeDraft={updateFiltersLive}
        filteredProductCount={displayProductCount}
        onClear={clearFilters}
        facetSizes={facets.sizes}
        facetCategories={facets.categories}
        facetColourGroups={facets.colourGroups}
        facetSizeCounts={facets.sizeCounts}
        facetCategoryCounts={facets.categoryCounts}
        facetColourGroupCounts={facets.colourGroupCounts}
        priceSliderMin={priceMeta.min}
        priceSliderMax={priceMeta.max}
        priceCurrencyCode={priceMeta.currencyCode}
      />
      <CollectionPlpSortModal
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        sort={sort}
        onSelect={setSort}
      />
    </SafeAreaView>
  );
}

