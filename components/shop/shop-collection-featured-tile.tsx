import { useRouter, usePathname } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { Skeleton } from '@/components/ui/skeleton';
import {
  COLLECTIONS_TAB_FEATURED_ASPECT,
  COLLECTIONS_TAB_FEATURED_BORDER_RADIUS,
  COLLECTIONS_TAB_FEATURED_LABEL,
  COLLECTIONS_TAB_FEATURED_LABEL_BOTTOM,
} from '@/constants/collections-tab';
import { palette } from '@/constants/theme';
import type { CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';
import { extractCollectionHandleFromCmsUrl } from '@/utils/collection-cms-url';
import { collectionHref, collectionReturnToParam } from '@/utils/collection-navigation';
import { shopCollectionCoverUri } from '@/utils/shop-collection-cover-uri';

type Props = {
  item: CmsCollectionDisplayItem;
  tileWidth: number;
  screenWidth: number;
  imagePriority?: 'low' | 'normal' | 'high' | null;
  loading?: boolean;
};

function featuredLabel(item: CmsCollectionDisplayItem): string {
  const title = item.collection.title?.trim();
  if (title) return title;
  return item.collection.handle.replace(/-/g, ' ');
}

function ShopCollectionFeaturedTileInner({
  item,
  tileWidth,
  screenWidth,
  imagePriority = 'low',
  loading = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { collection, cmsUrl } = item;
  const label = featuredLabel(item);
  const tileHeight = Math.ceil(tileWidth / COLLECTIONS_TAB_FEATURED_ASPECT);

  const coverUri = useMemo(() => {
    const raw = collection.image?.url?.trim();
    if (!raw) return undefined;
    return shopCollectionCoverUri({
      url: raw,
      width: collection.image?.width,
      height: collection.image?.height,
      handle: collection.handle,
      screenWidth,
    });
  }, [collection.handle, collection.image, screenWidth]);

  const onPress = useCallback(() => {
    const target = cmsUrl?.trim();
    if (target) {
      const handle = extractCollectionHandleFromCmsUrl(target);
      if (handle) {
        router.push(collectionHref(handle, collectionReturnToParam(pathname), pathname));
        return;
      }
      void Linking.openURL(target);
      return;
    }
    router.push(collectionHref(collection.handle, collectionReturnToParam(pathname), pathname));
  }, [cmsUrl, collection.handle, pathname, router]);

  if (loading) {
    return (
      <View style={{ width: tileWidth, height: tileHeight }}>
        <Skeleton
          className="bg-warmElevated/85"
          style={{ width: tileWidth, height: tileHeight, borderRadius: COLLECTIONS_TAB_FEATURED_BORDER_RADIUS }}
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} collection`}
      onPress={onPress}
      style={({ pressed }) => ({
        width: tileWidth,
        height: tileHeight,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}>
      <View
        style={{
          width: tileWidth,
          height: tileHeight,
          borderRadius: COLLECTIONS_TAB_FEATURED_BORDER_RADIUS,
          overflow: 'hidden',
          backgroundColor: '#EDECE8',
        }}>
        {coverUri ? (
          <CatalogCoverImage
            uri={coverUri}
            recyclingKey={collection.id}
            priority={imagePriority}
            transition={null}
            contentPosition="center"
          />
        ) : null}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 14,
            paddingBottom: COLLECTIONS_TAB_FEATURED_LABEL_BOTTOM,
          }}>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: COLLECTIONS_TAB_FEATURED_LABEL.fontFamily,
              fontSize: COLLECTIONS_TAB_FEATURED_LABEL.fontSize,
              lineHeight: COLLECTIONS_TAB_FEATURED_LABEL.lineHeight,
              letterSpacing: COLLECTIONS_TAB_FEATURED_LABEL.letterSpacing,
              textTransform: 'uppercase',
              textAlign: 'center',
              color: palette.surface,
              textShadowColor: 'rgba(0, 0, 0, 0.45)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}>
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export const ShopCollectionFeaturedTile = memo(
  ShopCollectionFeaturedTileInner,
  (prev, next) =>
    prev.item.collection.id === next.item.collection.id &&
    prev.item.collection.handle === next.item.collection.handle &&
    prev.item.collection.title === next.item.collection.title &&
    prev.item.collection.image?.url === next.item.collection.image?.url &&
    prev.item.cmsUrl === next.item.cmsUrl &&
    prev.tileWidth === next.tileWidth &&
    prev.screenWidth === next.screenWidth &&
    prev.imagePriority === next.imagePriority &&
    prev.loading === next.loading,
);

ShopCollectionFeaturedTile.displayName = 'ShopCollectionFeaturedTile';
