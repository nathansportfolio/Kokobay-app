import { useNavigation } from '@react-navigation/native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionPlpFilterModal } from '@/components/plp/collection-plp-filter-modal';
import { CollectionPlpSortModal } from '@/components/plp/collection-plp-sort-modal';
import { CollectionPlpToolbar } from '@/components/plp/collection-plp-toolbar';
import { CollectionProductTile } from '@/components/plp/collection-product-tile';
import { PlpInfiniteScrollFooter } from '@/components/plp/plp-infinite-scroll-footer';
import { PlpNoResultsSuggestions } from '@/components/plp/plp-no-results-suggestions';
import { PlpProductCountLabel } from '@/components/plp/plp-product-count-label';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LuxuryRefreshControl } from '@/components/ui/luxury-refresh-control';
import { ProductGridSkeleton } from '@/components/ui/product-grid-skeleton';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { luxuryTabPlpListHeaderPaddingTop, luxuryChrome } from '@/constants/luxury-nav';
import { useAppErrorBannerChromeHeight } from '@/hooks/use-app-error-banner-content';
import {
  PLP_COLUMN_GAP,
  PLP_HORIZONTAL_PAD,
  PLP_LIST_BOTTOM_PAD,
  PLP_MAINTAIN_VISIBLE_CONTENT_POSITION,
  plpScreenShell,
} from '@/constants/plp-scroll';
import { palette } from '@/constants/theme';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useKokobayPlpEndReached } from '@/hooks/use-kokobay-plp-end-reached';
import { useCollectionPlpRenderTrace } from '@/hooks/use-collection-plp-render-trace';
import { useKokobayCatalogQueryCleanup } from '@/hooks/use-kokobay-catalog-query-cleanup';
import { useKokobaySearchCatalog } from '@/hooks/use-kokobay-catalog-pages';
import { usePlpDisplayProducts } from '@/hooks/use-plp-display-products';
import { usePlpScrollToTop } from '@/hooks/use-plp-scroll-to-top';
import { usePlpScrollOffsetTrace } from '@/hooks/use-plp-scroll-offset-trace';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { useOptionalBottomTabBarHeight } from '@/hooks/use-optional-bottom-tab-bar-height';
import { useStableTopInset } from '@/hooks/use-stable-top-inset';
import { useQueryPullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useScreenLoadTrace } from '@/hooks/use-screen-load-trace';
import { resetPlpPerfTrace } from '@/lib/plp-perf-trace';
import { resetPlpScrollDebug } from '@/lib/plp-scroll-debug';
import { trackSearch, trackViewItemList } from '@/lib/gtm';
import { searchProducts } from '@/services/shopify';
import { defaultPlpFilters, type PlpFilters, type PlpSort } from '@/types/plp';
import type { Product } from '@/types/shopify';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { useMarketStore } from '@/store/market-preference';
import {
  countActivePlpFilters,
  extractFacets,
  normalizePlpPriceRangeForDraft,
  plpPriceSliderMetaForCurrency,
} from '@/utils/plp';
import { hasActivePlpFilters } from '@/utils/storefront-filters';
import { collectionProductCellHeight } from '@/utils/plp-layout';
import { keepPreviousDataForQueryKeyMatch } from '@/utils/react-query-placeholder';

function normalizeParam(value: string | string[] | undefined): string {
  if (value == null) return '';
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

type SearchPlpViewProps = {
  query: string;
};

function SearchPlpView({ query: trimmedQ }: SearchPlpViewProps) {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = useStableTopInset();
  const appErrorBannerHeight = useAppErrorBannerChromeHeight();
  const listHeaderPaddingTop = luxuryTabPlpListHeaderPaddingTop(appErrorBannerHeight);
  const tabBarHeight = useOptionalBottomTabBarHeight();
  const { width } = useWindowDimensions();
  const isWebCatalog = isKokobayWebProductsConfigured();

  const [filters, setFilters] = useState<PlpFilters>(defaultPlpFilters);
  const [sort, setSort] = useState<PlpSort>('featured');
  const [numColumns, setNumColumns] = useState<1 | 2>(2);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const listRef = useRef<FlashListRef<Product>>(null);

  const horizontalPad = PLP_HORIZONTAL_PAD;
  const columnGap = PLP_COLUMN_GAP;
  const contentWidth = width - horizontalPad * 2;
  const itemWidth =
    numColumns === 1 ? contentWidth : Math.floor((contentWidth - columnGap) / numColumns);
  const cellHeight = useMemo(
    () => collectionProductCellHeight(itemWidth, numColumns),
    [itemWidth, numColumns],
  );

  useKokobayCatalogQueryCleanup('search');

  const kokobaySearch = useKokobaySearchCatalog(trimmedQ, isWebCatalog, {
    plpFilters: filters,
    sort,
  });

  const marketKey = useMarketQueryKey();
  const marketCurrency = useMarketStore((s) => s.currencyCode);

  const {
    data: legacyAllProducts,
    isPending: legacySearchPending,
    isError: legacySearchError,
    refetch: refetchLegacySearch,
    isRefetching: legacySearchRefetching,
    dataUpdatedAt: legacySearchDataUpdatedAt,
  } = useQuery({
    queryKey: ['search', 'plp', trimmedQ, marketKey],
    enabled: trimmedQ.length >= 1 && !isWebCatalog,
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousDataForQueryKeyMatch<
      Product[],
      readonly ['search', 'plp', string, string]
    >(2, trimmedQ),
    queryFn: async () => searchProducts(trimmedQ, 48),
  });

  const allProducts = isWebCatalog ? kokobaySearch.products : legacyAllProducts;
  const searchPending = isWebCatalog ? kokobaySearch.isPending : legacySearchPending;
  const searchError = isWebCatalog ? kokobaySearch.isError : legacySearchError;
  const searchRefetching = isWebCatalog ? kokobaySearch.isRefetching : legacySearchRefetching;
  const refetchSearch = isWebCatalog ? kokobaySearch.refetch : refetchLegacySearch;

  const priceMeta = useMemo(
    () => plpPriceSliderMetaForCurrency(marketCurrency),
    [marketCurrency],
  );

  const facets = useMemo(() => {
    if (isWebCatalog) {
      return kokobaySearch.filterFacets;
    }
    return extractFacets(allProducts ?? []);
  }, [isWebCatalog, kokobaySearch.filterFacets, allProducts]);

  const serverSideFiltersActive =
    isWebCatalog &&
    hasActivePlpFilters(filters, priceMeta.min, priceMeta.max) &&
    kokobaySearch.serverSideFiltersCapable;
  const hasSelectedFilters = countActivePlpFilters(filters, priceMeta.min, priceMeta.max) > 0;

  const { rows: flatItems, totalFiltered } = usePlpDisplayProducts(allProducts, filters, sort, {
    skipClientFilters: serverSideFiltersActive,
  });

  const plpTraceReason = useMemo(() => {
    const parts: string[] = [];
    if (trimmedQ) parts.push(`q:${trimmedQ}`);
    if (hasSelectedFilters) parts.push('filters');
    if (sort !== 'featured') parts.push('sort');
    if (searchPending) parts.push('search_pending');
    if (searchRefetching) parts.push('search_refetching');
    if (isWebCatalog) parts.push('web_catalog');
    else parts.push('legacy_catalog');
    return parts.length ? parts.join('+') : 'stable';
  }, [
    trimmedQ,
    hasSelectedFilters,
    sort,
    searchPending,
    searchRefetching,
    isWebCatalog,
  ]);

  const searchDataUpdatedAt = isWebCatalog
    ? kokobaySearch.dataUpdatedAt
    : legacySearchDataUpdatedAt;

  useCollectionPlpRenderTrace({
    screen: 'search',
    allProducts,
    flatItems,
    queryDataUpdatedAt: searchDataUpdatedAt,
    isFetching: searchRefetching,
    reason: plpTraceReason,
  });

  const displayProductCount =
    isWebCatalog && kokobaySearch.totalProductCount != null
      ? kokobaySearch.totalProductCount
      : totalFiltered;

  const onEndReached = useKokobayPlpEndReached({
    screen: 'search',
    enabled: isWebCatalog,
    hasNextPage: kokobaySearch.hasNextPage,
    isFetchingNextPage: kokobaySearch.isFetchingNextPage,
    fetchNextPage: kokobaySearch.fetchNextPage,
    itemCount: flatItems.length,
  });

  const { chainScrollHandler } = usePlpScrollOffsetTrace({
    screen: 'search',
    itemCount: flatItems.length,
    isFetchingNextPage: kokobaySearch.isFetchingNextPage,
  });

  const catalogQueryFetching =
    isWebCatalog && kokobaySearch.isFetching && !kokobaySearch.isFetchingNextPage;

  const listLoading =
    !hasSelectedFilters &&
    (searchPending || (trimmedQ.length >= 1 && allProducts === undefined));

  const showPlpSkeleton =
    flatItems.length === 0 && (listLoading || catalogQueryFetching);

  const searchTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!trimmedQ || searchTrackedRef.current === trimmedQ) return;
    searchTrackedRef.current = trimmedQ;
    trackSearch(trimmedQ);
  }, [trimmedQ]);

  const viewListTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (listLoading || flatItems.length === 0 || !trimmedQ) return;
    const listKey = `search::${trimmedQ}::${flatItems.length}`;
    if (viewListTrackedRef.current === listKey) return;
    viewListTrackedRef.current = listKey;
    trackViewItemList({
      listId: `search:${trimmedQ}`,
      listName: `Search: ${trimmedQ}`,
      products: flatItems,
      currency: marketCurrency,
    });
  }, [flatItems, listLoading, marketCurrency, trimmedQ]);

  const scrollToTopSearch = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);
  const { onScroll: onSearchPlpScroll } = useBindScrollToTop(scrollToTopSearch, !searchError);
  const onPlpScroll = useMemo(
    () => chainScrollHandler(onSearchPlpScroll),
    [chainScrollHandler, onSearchPlpScroll],
  );

  useEffect(() => {
    setFilters(defaultPlpFilters);
    setSort('featured');
    resetPlpPerfTrace('search', { query: trimmedQ });
    resetPlpScrollDebug('search');
  }, [trimmedQ]);

  usePlpScrollToTop(listRef, {
    sort,
    filters,
    scopeKey: trimmedQ,
    dataEpoch: searchDataUpdatedAt,
  });

  const plpTitle = trimmedQ === '*' ? 'Products' : trimmedQ;
  const quotedSearchTitle = `"${plpTitle.replace(/"/g, '\u2019')}"`;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false, title: plpTitle });
  }, [navigation, plpTitle]);

  const openFilter = useCallback(() => {
    setFilterOpen(true);
  }, []);

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

  const onRefresh = useQueryPullToRefresh(refetchSearch).onRefresh;

  const goBackToSearchField = useCallback(() => {
    router.push({
      pathname: '/search-overlay',
      params: { seed: trimmedQ },
    } as Href);
  }, [router, trimmedQ]);

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
        perfTraceScreen="search"
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
              onPress={goBackToSearchField}
              accessibilityRole="button"
              accessibilityLabel="Edit search"
              hitSlop={14}
              className="absolute bottom-0 left-4 top-0 z-10 justify-center p-1 active:opacity-70">
              <IconSymbol name="chevron.left" size={18} color={palette.ink} />
            </Pressable>
            <View className="items-center">
              <Text
                variant="body"
                className="text-center font-sans text-[13px] font-normal leading-5 tracking-wide"
                numberOfLines={2}
                accessibilityLabel={`Search: ${plpTitle}`}
                style={{ color: palette.ink }}>
                {quotedSearchTitle}
              </Text>
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
    plpTitle,
    quotedSearchTitle,
    goBackToSearchField,
    openFilter,
    toggleGrid,
    numColumns,
    filters,
    horizontalPad,
    insets.top,
    topInset,
    priceMeta.max,
    priceMeta.min,
    totalFiltered,
    displayProductCount,
    allProducts,
    isWebCatalog,
  ]);

  const listEmpty = useMemo(() => {
    if (totalFiltered === 0 && (hasSelectedFilters || (allProducts?.length ?? 0) > 0)) {
      return (
        <PlpNoResultsSuggestions variant="filtered" onClearFilters={clearFilters} />
      );
    }
    if (!listLoading && (allProducts?.length ?? 0) === 0 && !hasSelectedFilters) {
      return <PlpNoResultsSuggestions variant="empty-search" />;
    }
    return null;
  }, [totalFiltered, allProducts?.length, hasSelectedFilters, clearFilters, listLoading]);

  const listFooter = useMemo(() => {
    if (!isWebCatalog) return null;
    return <PlpInfiniteScrollFooter visible={kokobaySearch.isFetchingNextPage} />;
  }, [isWebCatalog, kokobaySearch.isFetchingNextPage]);

  let renderBranch = 'content';
  if (searchError && flatItems.length === 0) renderBranch = 'error';
  else if (showPlpSkeleton) renderBranch = 'skeleton';

  useScreenLoadTrace({
    screen: 'search',
    routeKey: trimmedQ,
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
      searchPending,
    },
    queries: [
      isWebCatalog
        ? {
            key: `["kokobay","search-products","${trimmedQ}"]`,
            isPending: kokobaySearch.isPending,
            isFetching: kokobaySearch.isFetching,
            isError: kokobaySearch.isError,
            dataUndefined: kokobaySearch.products === undefined,
            enabled: trimmedQ.length >= 1,
          }
        : {
            key: `["search","plp","${trimmedQ}"]`,
            isPending: legacySearchPending,
            isFetching: legacySearchRefetching,
            isError: legacySearchError,
            dataUndefined: legacyAllProducts === undefined,
            enabled: trimmedQ.length >= 1 && !isWebCatalog,
          },
    ],
  });

  if (searchError && flatItems.length === 0) {
    return (
      <Screen scroll refreshing={searchRefetching} onRefresh={onRefresh}>
        <View style={{ height: topInset + listHeaderPaddingTop }} />
        <EmptyState title="Something went wrong" message="We could not load results for this search. Try again.">
          <Button title="Try again" variant="primary" onPress={() => void refetchSearch()} />
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

  return (
    <SafeAreaView style={plpScreenShell} collapsable={false} edges={['left', 'right']}>
      <FlashList<Product>
        ref={listRef}
        style={plpScreenShell}
        key={`${trimmedQ}-${numColumns}-${sort}`}
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
        refreshControl={
          <LuxuryRefreshControl refreshing={searchRefetching} onRefresh={onRefresh} />
        }
      />
      <CollectionPlpFilterModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        draft={filters}
        onChangeDraft={updateFiltersLive}
        filteredProductCount={totalFiltered}
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
      <CollectionPlpSortModal visible={sortOpen} onClose={() => setSortOpen(false)} sort={sort} onSelect={setSort} />
    </SafeAreaView>
  );
}

/**
 * `/search` with `q`: collection-style PLP. Without `q`, redirect to full-screen search overlay.
 */
export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const q = useMemo(() => normalizeParam(params.q).trim(), [params.q]);

  if (!q) {
    return <Redirect href="/search-overlay" />;
  }

  return <SearchPlpView query={q} />;
}
