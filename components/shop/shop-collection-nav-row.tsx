import { usePathname, useRouter } from 'expo-router';
import { memo, useCallback } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Skeleton } from '@/components/ui/skeleton';
import {
  COLLECTIONS_TAB_HORIZONTAL_PAD,
  COLLECTIONS_TAB_NAV_LABEL,
  COLLECTIONS_TAB_NAV_ROW_GAP,
  COLLECTIONS_TAB_NAV_ROW_HEIGHT,
} from '@/constants/collections-tab';
import { palette } from '@/constants/theme';
import type { CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';
import { extractCollectionHandleFromCmsUrl } from '@/utils/collection-cms-url';
import { collectionHref, collectionReturnToParam, pushCollection } from '@/utils/collection-navigation';

type Props = {
  item: CmsCollectionDisplayItem;
  loading?: boolean;
};

function navLabel(item: CmsCollectionDisplayItem): string {
  const title = item.collection.title?.trim();
  if (title) return title;
  return item.collection.handle.replace(/-/g, ' ');
}

function ShopCollectionNavRowInner({ item, loading = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { collection, cmsUrl } = item;
  const label = navLabel(item);

  const handlePress = useCallback(() => {
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
    pushCollection(
      router,
      collection.handle,
      collectionReturnToParam(pathname),
      pathname,
    );
  }, [cmsUrl, collection.handle, pathname, router]);

  return (
    <View
      style={{
        paddingHorizontal: COLLECTIONS_TAB_HORIZONTAL_PAD,
        paddingBottom: COLLECTIONS_TAB_NAV_ROW_GAP,
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} collection`}
        onPress={handlePress}
        disabled={loading}
        className="flex-row items-center justify-between active:opacity-70"
        style={{
          minHeight: COLLECTIONS_TAB_NAV_ROW_HEIGHT,
        }}>
        {loading ? (
          <Skeleton className="rounded-sm bg-warmElevated/85" style={{ height: 14, width: 160 }} />
        ) : (
          <View className="min-w-0 flex-1 pr-4">
            <Text
              numberOfLines={1}
              style={{
                fontFamily: COLLECTIONS_TAB_NAV_LABEL.fontFamily,
                fontSize: COLLECTIONS_TAB_NAV_LABEL.fontSize,
                lineHeight: COLLECTIONS_TAB_NAV_LABEL.lineHeight,
                letterSpacing: COLLECTIONS_TAB_NAV_LABEL.letterSpacing,
                textTransform: 'uppercase',
                color: palette.ink,
              }}>
              {label}
            </Text>
          </View>
        )}
        <View className="shrink-0">
          <IconSymbol name="chevron.right" size={18} color={palette.mist} weight="medium" />
        </View>
      </Pressable>
    </View>
  );
}

export const ShopCollectionNavRow = memo(
  ShopCollectionNavRowInner,
  (prev, next) =>
    prev.loading === next.loading &&
    prev.item.collection.id === next.item.collection.id &&
    prev.item.collection.handle === next.item.collection.handle &&
    prev.item.collection.title === next.item.collection.title &&
    prev.item.cmsUrl === next.item.cmsUrl,
);

ShopCollectionNavRow.displayName = 'ShopCollectionNavRow';
