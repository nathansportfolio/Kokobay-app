import { Link, usePathname } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { HomeSectionTitle } from '@/components/home/home-section-title';
import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { ShopCollectionEditorialCard } from '@/components/shop/shop-collection-editorial-card';
import {
  SHOP_COLLECTION_STRIP_GAP,
  SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING,
} from '@/components/shop/shop-collection-layout';
import { Text } from '@/components/ui/text';
import type { Collection } from '@/types/shopify';
import type { CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';
import { collectionBlurb, collectionsWithCoverImage } from '@/utils/collection-text';
import { collectionHref } from '@/utils/collection-navigation';
import { cn } from '@/utils/cn';

export type ShopCollectionCardLayout = 'compact' | 'editorial' | 'strip';

export {
  SHOP_CATEGORY_EDITORIAL_ASPECT,
  shopByCategoryEditorialItemHeight,
  shopByCategoryEditorialListHeight,
} from '@/components/shop/shop-collection-layout';

type Props = {
  /** CMS tiles and/or catalog collections (prefer `items` when using collections-cms). */
  items?: CmsCollectionDisplayItem[];
  collections?: Collection[];
  /** Staggered row fade — off on Home (whole screen already fades in). */
  staggerRowEntrance?: boolean;
  /** When true, link to the Shop tab after the editorial list (home only). */
  showViewAllCollections?: boolean;
  /** When false, only the collection cards render (e.g. Shop tab with its own heading). */
  showSectionHeader?: boolean;
  /** Omit outer horizontal padding when the parent screen already applies `px-5`. */
  omitContentPadding?: boolean;
  /**
   * `strip` = short cover strip with overlaid title (Shop tab + Home).
   * `editorial` = image-led full-bleed tiles.
   * `compact` = legacy row + border (unused unless opted in).
   */
  cardLayout?: ShopCollectionCardLayout;
  /** Required for `strip` layout — CDN cover sizing. */
  screenWidth?: number;
};

function HomeShopByCategoryInner({
  items,
  collections = [],
  staggerRowEntrance = true,
  showViewAllCollections = false,
  showSectionHeader = true,
  omitContentPadding = false,
  cardLayout = 'strip',
  screenWidth,
}: Props) {
  const pathname = usePathname();
  const displayItems = useMemo((): CmsCollectionDisplayItem[] => {
    if (items?.length) return items;
    return collectionsWithCoverImage(collections).map((collection) => ({
      collection,
      cmsUrl: undefined,
    }));
  }, [collections, items]);

  const renderCompactRow = useCallback((c: Collection) => {
    const description = collectionBlurb(c);
    return (
      <Link key={c.id} href={collectionHref(c.handle, pathname)} asChild>
        <Pressable className="flex-row gap-4 overflow-hidden rounded-sm border border-line bg-surface active:opacity-90">
          <View className="relative h-24 w-20 shrink-0 overflow-hidden bg-elevated">
            {c.image?.url ? (
              <CatalogCoverImage uri={c.image.url} recyclingKey={c.id} priority="low" />
            ) : null}
          </View>
          <View className="min-w-0 flex-1 justify-center py-3 pr-3">
            <Text variant="label" className="mb-1 text-accent">
              {c.handle.replace(/-/g, ' ')}
            </Text>
            <Text variant="title" className="text-[17px]" numberOfLines={2}>
              {c.title}
            </Text>
            {description ? (
              <Text variant="caption" className="mt-1 text-mist" numberOfLines={3}>
                {description}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Link>
    );
  }, [pathname]);

  const renderEditorialRow = useCallback(
    (c: Collection, index: number) => {
      const row = (
        <View className="-mx-5">
          <ShopCollectionEditorialCard
            collection={c}
            imagePriority={index < 2 ? 'normal' : 'low'}
          />
        </View>
      );

      if (!staggerRowEntrance) {
        return <View key={c.id}>{row}</View>;
      }

      return (
        <Animated.View
          key={c.id}
          entering={FadeIn.duration(420).delay(Math.min(index * 48, 360))}>
          {row}
        </Animated.View>
      );
    },
    [staggerRowEntrance],
  );

  const renderStripRow = useCallback(
    (item: CmsCollectionDisplayItem, index: number) => {
      const row = (
        <View
          key={item.collection.id}
          style={
            omitContentPadding ?
              { paddingHorizontal: SHOP_COLLECTION_STRIP_HORIZONTAL_PADDING }
            : undefined
          }>
          <ShopCollectionEditorialCard
            collection={item.collection}
            cmsUrl={item.cmsUrl}
            variant="strip"
            imagePriority={index < 6 ? 'normal' : 'low'}
            disableImageTransition
            screenWidth={screenWidth}
          />
        </View>
      );

      if (!staggerRowEntrance) {
        return row;
      }

      return (
        <Animated.View
          key={item.collection.id}
          entering={FadeIn.duration(420).delay(Math.min(index * 48, 360))}>
          {row}
        </Animated.View>
      );
    },
    [omitContentPadding, screenWidth, staggerRowEntrance],
  );

  const list = useMemo(() => {
    if (cardLayout === 'strip') {
      return (
        <View style={{ gap: SHOP_COLLECTION_STRIP_GAP }}>
          {displayItems.map((item, index) => renderStripRow(item, index))}
        </View>
      );
    }
    if (cardLayout === 'editorial') {
      return displayItems.map((item, index) => renderEditorialRow(item.collection, index));
    }
    return (
      <View className="gap-3">
        {displayItems.map((item) => renderCompactRow(item.collection))}
      </View>
    );
  }, [cardLayout, displayItems, renderCompactRow, renderEditorialRow, renderStripRow]);

  return (
    <View className={cn(!omitContentPadding && 'px-5')}>
      {showSectionHeader ? (
        <HomeSectionTitle title="Collections" />
      ) : null}
      {!displayItems.length ? (
        <Text variant="caption" className="text-mist">
          No collections available right now.
        </Text>
      ) : (
        list
      )}
      {showViewAllCollections && displayItems.length > 0 ? (
        <Link href="/categories" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all collections"
            className="mt-2 self-start py-2 active:opacity-70">
            <Text variant="label" className="text-accent">
              View all collections
            </Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

export const HomeShopByCategory = memo(HomeShopByCategoryInner);
