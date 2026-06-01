import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeProductCarousel } from '@/components/home/home-product-carousel';
import {
  SearchCarouselSkeleton,
  SearchSuggestionsSkeleton,
} from '@/components/search/search-carousel-skeleton';
import { LuxuryRefreshControl } from '@/components/ui/luxury-refresh-control';
import { Text } from '@/components/ui/text';
import { luxuryChrome } from '@/constants/luxury-nav';
import { palette } from '@/constants/theme';
import { useHomeCatalogQuery } from '@/hooks/use-home-catalog-query';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useGlobalPullToRefresh } from '@/hooks/use-pull-to-refresh';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { fetchKokobayPredictiveSearch } from '@/services/kokobay-web/search';
import { searchProducts } from '@/services/shopify';
import type { Product } from '@/types/shopify';
import { hapticLight } from '@/utils/haptics';
import { productHref } from '@/utils/product-navigation';

function normalizeSeed(value: string | string[] | undefined): string {
  if (value == null) return '';
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

const CAROUSEL_DEBOUNCE_MS = 500;
const CAROUSEL_FETCH_FIRST = 12;
/** Matches `ScrollView` `contentContainerStyle.paddingHorizontal`. */
const SCROLL_H_PAD = 16;
/** `HomeProductTile` uses `mr-4` between cards. */
const CAROUSEL_TILE_GAP = 16;
const CAROUSEL_END_INSET = 12;
/** First N products from the same list as home “New in” (home shows more in a longer carousel). */
const SEARCH_LATEST_COUNT = 5;
const FADE_MS = 300;
const STAGGER_MS = 40;
const easeOutCubic = Easing.out(Easing.cubic);

export default function SearchOverlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ seed?: string | string[] }>();
  const seed = useMemo(() => normalizeSeed(params.seed), [params.seed]);

  const [q, setQ] = useState('');
  const trimmed = q.trim();
  const hasQuery = trimmed.length > 0;
  const debouncedTrimmed = useDebouncedValue(trimmed, CAROUSEL_DEBOUNCE_MS);
  const marketKey = useMarketQueryKey();

  useEffect(() => {
    if (seed) setQ(seed);
  }, [seed]);

  const predictiveEnabled =
    isKokobayWebProductsConfigured() && debouncedTrimmed.length >= 2 && debouncedTrimmed === trimmed;

  const { data: predictive } = useQuery({
    queryKey: ['search-predictive', debouncedTrimmed],
    enabled: predictiveEnabled,
    staleTime: 60_000,
    queryFn: () => fetchKokobayPredictiveSearch(debouncedTrimmed, 8),
  });

  const suggestions = useMemo(() => {
    if (!hasQuery || trimmed.length < 2 || !predictiveEnabled) return [];
    return predictive?.suggestions ?? [];
  }, [hasQuery, trimmed.length, predictiveEnabled, predictive?.suggestions]);

  const { data: homeCatalog, isPending: homeCatalogPending, refetch: refetchHomeCatalog } =
    useHomeCatalogQuery();

  const { refreshing, onRefresh } = useGlobalPullToRefresh(async () => {
    await refetchHomeCatalog();
  });

  /** Same source as home “New in” — first five for the compact search rail. */
  const latestProducts = useMemo(
    () => homeCatalog?.newIn?.slice(0, SEARCH_LATEST_COUNT) ?? [],
    [homeCatalog],
  );

  const debounceSettled = trimmed.length > 0 && debouncedTrimmed === trimmed;

  const { data: foundProducts, isPending: searchResultsPending, isError: searchResultsError } = useQuery({
    queryKey: ['search-overlay-carousel', debouncedTrimmed, marketKey],
    enabled: debouncedTrimmed.length >= 1,
    staleTime: 2 * 60_000,
    queryFn: () => searchProducts(debouncedTrimmed, CAROUSEL_FETCH_FIRST),
  });

  const carouselProducts: Product[] = useMemo(() => {
    if (!trimmed) return latestProducts;
    if (!debounceSettled) return latestProducts;
    if (searchResultsError) return latestProducts;
    if (searchResultsPending && foundProducts === undefined) return latestProducts;
    return foundProducts ?? [];
  }, [trimmed, debounceSettled, searchResultsError, searchResultsPending, foundProducts, latestProducts]);

  const showLatestSkeleton = !hasQuery && homeCatalogPending && latestProducts.length === 0;

  const showSearchCarouselSkeleton =
    trimmed.length > 0 &&
    debounceSettled &&
    searchResultsPending &&
    foundProducts === undefined;

  const suggestionsPending =
    isKokobayWebProductsConfigured() &&
    hasQuery &&
    trimmed.length >= 2 &&
    predictiveEnabled &&
    predictive === undefined;

  const showSuggestionsSection =
    hasQuery && trimmed.length >= 2 && (suggestionsPending || suggestions.length > 0);

  const carouselVisualKey = useMemo(() => {
    if (!hasQuery) return 'idle';
    if (!debounceSettled) return 'placeholder';
    if (showSearchCarouselSkeleton) return `loading-${debouncedTrimmed}`;
    if (carouselProducts.length > 0) return `ready-${debouncedTrimmed}`;
    return `empty-${debouncedTrimmed}`;
  }, [hasQuery, debounceSettled, showSearchCarouselSkeleton, debouncedTrimmed, carouselProducts.length]);

  const tileWidth = useMemo(() => {
    const viewport = Math.max(0, width - SCROLL_H_PAD * 2);
    return Math.min(300, Math.max(148, Math.floor((viewport - CAROUSEL_TILE_GAP) / 1.5)));
  }, [width]);

  const carouselHeight = useMemo(
    () => Math.ceil(tileWidth * (4 / 3)) + 100,
    [tileWidth],
  );

  const commitSearch = useCallback(() => {
    const t = q.trim();
    if (!t) return;
    hapticLight();
    Keyboard.dismiss();
    // Dismiss modal and land on `/search` in one step — `replace` alone can flash the underlying tab (e.g. home) first.
    router.dismissTo({ pathname: '/search', params: { q: t } } as Href);
  }, [q, router]);

  const onCancel = useCallback(() => {
    Keyboard.dismiss();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as Href);
    }
  }, [router]);

  const onSuggestionPress = useCallback(
    (label: string) => {
      setQ(label);
      Keyboard.dismiss();
      router.dismissTo({ pathname: '/search', params: { q: label.trim() } } as Href);
    },
    [router],
  );

  const onProductFromSearchOverlay = useCallback(
    (handle: string) => {
      Keyboard.dismiss();
      router.dismiss();
      requestAnimationFrame(() => {
        router.push(productHref(handle, '/search'));
      });
    },
    [router],
  );

  const eyebrowStyle = {
    fontFamily: 'InstrumentSans-Medium' as const,
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(92, 91, 88, 0.75)',
    textTransform: 'uppercase' as const,
  };

  const headerTopPad = Math.max(insets.top, 12);

  return (
    <View className="flex-1 bg-warmCanvas">
      <View className="border-b border-line/60" style={{ paddingTop: headerTopPad }}>
        <View className="flex-row items-center gap-2 px-4 pb-3">
          <View className="min-h-[48px] min-w-0 flex-1 flex-row items-center rounded-2xl border border-line/55 bg-warmSurface px-3">
            <Pressable
              onPress={() => {
                if (hasQuery) commitSearch();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Search"
              disabled={!hasQuery}>
              <Search
                size={20}
                color={hasQuery ? palette.ink : 'rgba(92, 91, 88, 0.45)'}
                strokeWidth={1.65}
              />
            </Pressable>
            <TextInput
              value={q}
              onChangeText={setQ}
              onSubmitEditing={commitSearch}
              autoFocus
              placeholder="Search"
              placeholderTextColor="rgba(92, 91, 88, 0.45)"
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="never"
              style={{
                flex: 1,
                marginLeft: 8,
                paddingVertical: 12,
                fontFamily: 'InstrumentSans-Regular',
                fontSize: 16,
                color: luxuryChrome.ink,
              }}
            />
            {q.length > 0 ? (
              <Pressable
                onPress={() => setQ('')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear search text">
                <X size={20} color="rgba(92, 91, 88, 0.55)" strokeWidth={1.65} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={onCancel}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Cancel search">
            <Text
              style={{
                fontFamily: 'InstrumentSans-Medium',
                fontSize: 16,
                letterSpacing: -0.2,
                color: luxuryChrome.ink,
              }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={<LuxuryRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {showSuggestionsSection ? (
          <Animated.View
            entering={FadeInDown.duration(FADE_MS).easing(easeOutCubic)}
            accessibilityLabel="Search suggestions">
            <Text style={eyebrowStyle}>Suggestions</Text>
            {suggestionsPending ? (
              <SearchSuggestionsSkeleton />
            ) : (
              <View className="mt-3">
                {suggestions.map((label, index) => (
                  <Animated.View
                    key={label}
                    entering={FadeIn.duration(FADE_MS)
                      .delay(Math.min(index * STAGGER_MS, 160))
                      .easing(easeOutCubic)}>
                    <Pressable
                      onPress={() => onSuggestionPress(label)}
                      className="border-b border-line/40 py-3.5 active:opacity-75"
                      accessibilityRole="button"
                      accessibilityLabel={`Search ${label}`}>
                      <Text className="font-sans text-[16px] text-ink">{label}</Text>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>
        ) : !hasQuery ? (
          <Animated.View entering={FadeIn.duration(FADE_MS).easing(easeOutCubic)}>
            <Text style={eyebrowStyle}>Latest</Text>
          </Animated.View>
        ) : null}

        <Animated.View
          key={carouselVisualKey}
          entering={FadeIn.duration(FADE_MS).easing(easeOutCubic)}
          className={showSuggestionsSection || !hasQuery ? 'mt-8 -mx-1' : 'mt-3 -mx-1'}
          style={{ height: carouselHeight, overflow: 'hidden' }}
          accessibilityLabel={
            !hasQuery
              ? 'Latest products'
              : showSearchCarouselSkeleton
                ? 'Loading products'
                : 'Product suggestions'
          }>
          {!hasQuery ? (
            showLatestSkeleton ? (
              <SearchCarouselSkeleton tileWidth={tileWidth} />
            ) : latestProducts.length > 0 ? (
              <HomeProductCarousel
                products={latestProducts}
                tileWidth={tileWidth}
                contentPaddingEnd={CAROUSEL_END_INSET}
                onProductPress={onProductFromSearchOverlay}
              />
            ) : (
              <View className="flex-1 justify-center py-6" style={{ minHeight: carouselHeight * 0.45 }}>
                <Text variant="caption" className="text-center text-mist">
                  New in will appear here once the catalog has loaded.
                </Text>
              </View>
            )
          ) : showSearchCarouselSkeleton ? (
            <SearchCarouselSkeleton tileWidth={tileWidth} />
          ) : carouselProducts.length > 0 ? (
            <HomeProductCarousel
              products={carouselProducts}
              tileWidth={tileWidth}
              contentPaddingEnd={CAROUSEL_END_INSET}
              onProductPress={onProductFromSearchOverlay}
            />
          ) : (
            <View className="flex-1 justify-center py-6" style={{ minHeight: carouselHeight * 0.5 }}>
              <Text variant="caption" className="text-center text-mist">
                No pieces match that search yet.
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
