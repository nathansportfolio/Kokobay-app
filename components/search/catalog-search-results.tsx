import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import { useRouter, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, Keyboard, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useBindScrollToTop } from '@/contexts/scroll-to-top-context';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { catalogImageCache } from '@/constants/expo-image';
import { luxuryChrome } from '@/constants/luxury-nav';
import { trackSelectItem } from '@/lib/gtm';
import { searchCatalog, type CatalogSearchResult } from '@/services/search';
import { useSearchHistoryStore } from '@/store';
import type { Collection, Product } from '@/types/shopify';
import { firstValidProductImage } from '@/utils/catalog-image';
import { collectionsWithCoverImage } from '@/utils/collection-text';
import { formatMoney } from '@/utils/money';
import { productHref } from '@/utils/product-navigation';
import { collectionHref } from '@/utils/collection-navigation';
import { productTileImageUri } from '@/utils/product-tile-image-uri';

export type SearchResultRow =
  | { type: 'section'; key: string; title: string; height: number }
  | { type: 'collection'; key: string; collection: Collection; height: number }
  | { type: 'product'; key: string; product: Product; height: number }
  | { type: 'empty'; key: string; height: number };

function flattenSearchResults(display: CatalogSearchResult): SearchResultRow[] {
  const rows: SearchResultRow[] = [];
  const collectionRows = collectionsWithCoverImage(display.collections);
  if (collectionRows.length > 0) {
    rows.push({
      type: 'section',
      key: 'sec-coll',
      title: 'Collection suggestions',
      height: 44,
    });
    for (const c of collectionRows) {
      rows.push({ type: 'collection', key: `c:${c.id}`, collection: c, height: 96 });
    }
  }
  if (display.products.length > 0) {
    rows.push({
      type: 'section',
      key: 'sec-prod',
      title: 'Product suggestions',
      height: 44,
    });
    for (const p of display.products) {
      rows.push({
        type: 'product',
        key: `p:${p.handle}:${p.id}`,
        product: p,
        height: 100,
      });
    }
  } else if (collectionRows.length === 0) {
    rows.push({ type: 'empty', key: 'empty', height: 140 });
  }
  return rows;
}

type CatalogSearchResultsListProps = {
  /** Trimmed query passed to the search API (may be debounced upstream). */
  query: string;
  /** String stored in history when opening a product/collection from results. */
  historySnapshot: string;
  /** Optional footer below suggestions (e.g. “View all results”). */
  listFooterComponent?: ReactNode;
  /** Extra bottom padding for a floating control (e.g. primary CTA). */
  extraBottomInset?: number;
};

export function CatalogSearchResultsList({
  query,
  historySnapshot,
  listFooterComponent,
  extraBottomInset = 0,
}: CatalogSearchResultsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const addHistoryEntry = useSearchHistoryStore((s) => s.addEntry);
  const marketKey = useMarketQueryKey();

  const { data, isPending, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['catalogSearch', query, marketKey],
    queryFn: () => searchCatalog(query, 24),
    enabled: query.length >= 1,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const showResults = query.length >= 1;
  const showPredictiveSkeleton = showResults && isPending && !isPlaceholderData && !data;
  const display: CatalogSearchResult | undefined = data;

  const listRef = useRef<FlashListRef<SearchResultRow>>(null);
  const scrollToTopResults = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);
  const { onScroll: onResultsScroll } = useBindScrollToTop(
    scrollToTopResults,
    showResults && !showPredictiveSkeleton,
  );

  const searchResultRows = useMemo(
    () => (display ? flattenSearchResults(display) : []),
    [display],
  );

  const recordSearchAndNavigate = useCallback(
    (path: string, snapshot: string) => {
      if (snapshot.trim()) addHistoryEntry(snapshot.trim());
      Keyboard.dismiss();
      router.push(path as Href);
    },
    [addHistoryEntry, router],
  );

  const renderSearchRow = useCallback(
    ({ item }: { item: SearchResultRow }) => {
      switch (item.type) {
        case 'section':
          return (
            <Text
              style={{
                fontFamily: 'InstrumentSans-Medium',
                fontSize: 11,
                letterSpacing: 3.5,
                color: luxuryChrome.mist,
                textTransform: 'uppercase',
                marginBottom: 14,
              }}>
              {item.title}
            </Text>
          );
        case 'collection': {
          const c = item.collection;
          return (
            <Pressable
              onPress={() =>
                recordSearchAndNavigate(collectionHref(c.handle, pathname) as string, historySnapshot)
              }
              className="mb-3 flex-row items-center border-b border-line/35 py-3.5 active:opacity-78">
              {c.image?.url ? (
                <Image
                  source={{ uri: c.image.url }}
                  style={{ width: 52, height: 64, borderRadius: 12, marginRight: 14 }}
                  contentFit="cover"
                  recyclingKey={c.id}
                  {...catalogImageCache}
                />
              ) : (
                <View
                  style={{
                    width: 52,
                    height: 64,
                    borderRadius: 12,
                    marginRight: 14,
                    backgroundColor: 'rgba(245, 243, 240, 0.95)',
                  }}
                />
              )}
              <View className="min-w-0 flex-1">
                <Text
                  style={{
                    fontFamily: 'InstrumentSans-Medium',
                    fontSize: 15,
                    letterSpacing: -0.15,
                    color: luxuryChrome.ink,
                  }}
                  numberOfLines={2}>
                  {c.title}
                </Text>
                <Text style={{ fontFamily: 'InstrumentSans-Regular', fontSize: 12, color: luxuryChrome.mist }}>
                  Room
                </Text>
              </View>
            </Pressable>
          );
        }
        case 'product': {
          const p = item.product;
          const sourceImage = firstValidProductImage(p);
          const img = sourceImage
            ? productTileImageUri({
                url: sourceImage.url,
                width: sourceImage.width,
                height: sourceImage.height,
                tileWidth: 56,
                handle: p.handle,
              })
            : undefined;
          const price = formatMoney(p.priceRange.minVariantPrice);
          return (
            <Pressable
              onPress={() => {
                trackSelectItem({
                  product: p,
                  source_screen: 'search',
                  item_list_id: `search:${query}`,
                  item_list_name: `Search: ${query}`,
                  search_term: query,
                });
                recordSearchAndNavigate(productHref(p.handle, pathname) as string, historySnapshot);
              }}
              className="mb-3 flex-row items-center border-b border-line/35 py-3.5 active:opacity-78">
              {img ? (
                <Image
                  source={{ uri: img }}
                  style={{ width: 56, height: 72, borderRadius: 12, marginRight: 14 }}
                  contentFit="cover"
                  recyclingKey={p.id}
                  {...catalogImageCache}
                />
              ) : (
                <View
                  style={{
                    width: 56,
                    height: 72,
                    borderRadius: 12,
                    marginRight: 14,
                    backgroundColor: 'rgba(245, 243, 240, 0.95)',
                  }}
                />
              )}
              <View className="min-w-0 flex-1">
                <Text
                  style={{
                    fontFamily: 'InstrumentSans-Medium',
                    fontSize: 15,
                    letterSpacing: -0.15,
                    color: luxuryChrome.ink,
                  }}
                  numberOfLines={2}>
                  {p.title}
                </Text>
                <Text style={{ fontFamily: 'InstrumentSans-Regular', fontSize: 13, color: luxuryChrome.mist }}>
                  {price}
                </Text>
              </View>
            </Pressable>
          );
        }
        case 'empty':
          return (
            <View className="py-12">
              <Text style={{ fontFamily: 'InstrumentSans-Regular', fontSize: 15, color: luxuryChrome.mist }}>
                No pieces or rooms match that phrase. Try another keyword, pick a recent search, or browse a
                collection below.
              </Text>
            </View>
          );
        default:
          return null;
      }
    },
    [historySnapshot, pathname, query, recordSearchAndNavigate],
  );

  const searchKeyExtractor = useCallback((item: SearchResultRow) => item.key, []);

  const searchGetItemType = useCallback((item: SearchResultRow) => item.type, []);

  const searchOverrideItemLayout = useCallback((layout: { span?: number; size?: number }, item: SearchResultRow) => {
    layout.size = item.height;
  }, []);

  if (!showResults) {
    return null;
  }

  if (showPredictiveSkeleton) {
    return (
      <View className="flex-1 gap-3 px-5 pt-4">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="h-16 rounded-2xl bg-line/40" />
        ))}
      </View>
    );
  }

  return (
    <View className="flex-1">
      {isFetching ? (
        <View className="absolute right-5 top-2 z-10">
          <ActivityIndicator size="small" color={luxuryChrome.mist} />
        </View>
      ) : null}
      <FlashList<SearchResultRow>
        ref={listRef}
        style={{ flex: 1 }}
        data={searchResultRows}
        renderItem={renderSearchRow}
        keyExtractor={searchKeyExtractor}
        getItemType={searchGetItemType}
        overrideItemLayout={searchOverrideItemLayout}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        onScroll={onResultsScroll}
        scrollEventThrottle={16}
        drawDistance={400}
        ListFooterComponent={
          listFooterComponent != null ? <View>{listFooterComponent}</View> : undefined
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: (listFooterComponent ? 32 : 68) + extraBottomInset,
          paddingTop: 10,
        }}
      />
    </View>
  );
}
