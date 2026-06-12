import { Link, usePathname, useRouter } from 'expo-router';
import { memo, useCallback, useLayoutEffect, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import {
  SHOP_CATEGORY_EDITORIAL_ASPECT,
  SHOP_COLLECTION_EDITORIAL_TEXT_BLOCK,
  SHOP_COLLECTION_STRIP_BORDER_RADIUS,
  SHOP_COLLECTION_STRIP_HEIGHT,
  shopCollectionStripCardShadow,
} from '@/components/shop/shop-collection-layout';
import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { Text } from '@/components/ui/text';
import { useCollectionHref } from '@/hooks/use-collection-href';
import { extractCollectionHandleFromCmsUrl } from '@/utils/collection-cms-url';
import { collectionHref, collectionReturnToParam } from '@/utils/collection-navigation';
import {
  logShopTabFirstImageLoad,
  logShopTabFirstRowRender,
  logShopTabViewportImageLoad,
} from '@/lib/shop-tab-perf-trace';
import { SHOP_COLLECTION_VIEWPORT_PREFETCH_COUNT } from '@/utils/shop-collection-cover-prefetch';
import type { Collection } from '@/types/shopify';
import { collectionBlurb } from '@/utils/collection-text';
import { shopCollectionCoverUri } from '@/utils/shop-collection-cover-uri';

export type ShopCollectionCardVariant = 'editorial' | 'strip';

type Props = {
  collection: Collection;
  variant?: ShopCollectionCardVariant;
  /** expo-image fetch priority — first visible rows can use `normal`. */
  imagePriority?: 'low' | 'normal' | 'high' | null;
  /** Skip cross-fade in virtualized lists (smoother scroll). */
  disableImageTransition?: boolean;
  screenWidth?: number;
  /** Dev perf — only the first visible list row should pass `0`. */
  perfTraceRowIndex?: number;
  /** CMS tile URL — internal `/collections/{handle}` routes in-app; otherwise opens externally. */
  cmsUrl?: string;
};

function ShopCollectionEditorialCardInner({
  collection,
  variant = 'editorial',
  imagePriority = 'low',
  disableImageTransition = false,
  screenWidth,
  perfTraceRowIndex,
  cmsUrl,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const defaultCollectionHref = useCollectionHref(collection.handle);
  const description = collectionBlurb(collection);

  const onCmsTilePress = useCallback(() => {
    const target = cmsUrl?.trim();
    if (!target) return;
    const handle = extractCollectionHandleFromCmsUrl(target);
    if (handle) {
      router.push(
        collectionHref(handle, collectionReturnToParam(pathname), pathname),
      );
      return;
    }
    void Linking.openURL(target);
  }, [cmsUrl, pathname, router]);
  const coverUri = useMemo(() => {
    const raw = collection.image?.url;
    if (!raw) return undefined;
    return shopCollectionCoverUri({
      url: raw,
      width: collection.image?.width,
      height: collection.image?.height,
      handle: collection.handle,
      screenWidth,
    });
  }, [collection.handle, collection.image, screenWidth]);

  useLayoutEffect(() => {
    if (perfTraceRowIndex !== 0) return;
    logShopTabFirstRowRender({
      handle: collection.handle,
      collectionId: collection.id,
    });
  }, [collection.handle, collection.id, perfTraceRowIndex]);

  function handleCoverImageLoad(): void {
    const rowIndex = perfTraceRowIndex;
    if (rowIndex === 0) {
      logShopTabFirstImageLoad({
        handle: collection.handle,
        collectionId: collection.id,
        coverUri,
      });
    }
    if (
      rowIndex !== undefined &&
      rowIndex >= 0 &&
      rowIndex < SHOP_COLLECTION_VIEWPORT_PREFETCH_COUNT
    ) {
      logShopTabViewportImageLoad(rowIndex, {
        handle: collection.handle,
        collectionId: collection.id,
      });
    }
  }

  const stripBody = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${collection.title} collection`}
      onPress={cmsUrl ? onCmsTilePress : undefined}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.99 : 1 }],
        opacity: pressed ? 0.92 : 1,
      })}>
          <View
            style={{
              ...shopCollectionStripCardShadow,
              borderRadius: SHOP_COLLECTION_STRIP_BORDER_RADIUS,
            }}>
            <View
              style={{
                position: 'relative',
                width: '100%',
                height: SHOP_COLLECTION_STRIP_HEIGHT,
                overflow: 'hidden',
                backgroundColor: '#F5F3F0',
                borderRadius: SHOP_COLLECTION_STRIP_BORDER_RADIUS,
              }}>
              {coverUri ? (
                <CatalogCoverImage
                  uri={coverUri}
                  recyclingKey={collection.id}
                  priority={imagePriority}
                  transition={disableImageTransition ? null : 320}
                  contentPosition="center"
                  onLoad={handleCoverImageLoad}
                />
              ) : null}
              <View
                pointerEvents="none"
                style={{
                  ...StyleSheet.absoluteFillObject,
                  backgroundColor: 'rgba(28, 26, 24, 0.32)',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  paddingHorizontal: 20,
                }}>
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: 'InstrumentSans-SemiBold',
                    fontSize: 13,
                    lineHeight: 18,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                    color: '#FFFFFF',
                    textShadowColor: 'rgba(0, 0, 0, 0.55)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                  }}>
                  {collection.title}
                </Text>
                {description ? (
                  <Text
                    numberOfLines={2}
                    style={{
                      marginTop: 4,
                      fontFamily: 'InstrumentSans',
                      fontSize: 11,
                      lineHeight: 15,
                      color: 'rgba(255, 255, 255, 0.88)',
                      textShadowColor: 'rgba(0, 0, 0, 0.55)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 4,
                    }}>
                    {description}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
    </Pressable>
  );

  if (variant === 'strip') {
    if (cmsUrl) return stripBody;
    return (
      <Link href={defaultCollectionHref} asChild>
        {stripBody}
      </Link>
    );
  }

  const editorialBody = (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${collection.title} collection`}
        className="mb-11"
        onPress={cmsUrl ? onCmsTilePress : undefined}
        style={({ pressed }) => ({
          transform: [{ scale: pressed ? 0.987 : 1 }],
          opacity: pressed ? 0.92 : 1,
        })}>
        <View
          className="overflow-hidden bg-warmElevated"
          style={{ width: '100%', aspectRatio: SHOP_CATEGORY_EDITORIAL_ASPECT }}>
          {coverUri ? (
            <CatalogCoverImage
              uri={coverUri}
              recyclingKey={collection.id}
              priority={imagePriority}
              transition={disableImageTransition ? null : 320}
              onLoad={handleCoverImageLoad}
            />
          ) : null}
        </View>
        <View className="px-5 pt-5" style={{ minHeight: SHOP_COLLECTION_EDITORIAL_TEXT_BLOCK }}>
          <Text
            className="font-sans-md text-[17px] leading-[22px] tracking-[0.01em] text-ink/90"
            numberOfLines={2}>
            {collection.title}
          </Text>
          {description ? (
            <Text
              variant="caption"
              className="mt-2.5 max-w-[92%] font-sans text-[13px] leading-5 text-mist/90"
              numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>
      </Pressable>
  );

  if (cmsUrl) return editorialBody;
  return (
    <Link href={defaultCollectionHref} asChild>
      {editorialBody}
    </Link>
  );
}

export const ShopCollectionEditorialCard = memo(ShopCollectionEditorialCardInner);
