import { Link, usePathname } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { Text } from '@/components/ui/text';
import type { Collection } from '@/types/shopify';
import { collectionHref } from '@/utils/collection-navigation';
import { collectionsWithCoverImage } from '@/utils/collection-text';

type Props = {
  collections: Collection[];
};

function HomeCategoryRailInner({ collections }: Props) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const tileW = Math.min(168, Math.round(width * 0.42));
  const data = useMemo(() => collectionsWithCoverImage(collections), [collections]);

  if (!data.length) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      contentContainerStyle={{ paddingLeft: 20, paddingRight: 4 }}>
      {data.map((item, index) => (
        <Link key={item.id} href={collectionHref(item.handle, pathname)} asChild>
          <Pressable
            className="overflow-hidden rounded-sm border border-line/70 bg-surface active:opacity-90"
            style={{ width: tileW, marginRight: index === data.length - 1 ? 20 : 12 }}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title} collection`}>
            <View className="relative aspect-[4/5] w-full overflow-hidden bg-elevated">
              {item.image?.url ?
                <CatalogCoverImage uri={item.image.url} recyclingKey={item.id} />
              : null}
            </View>
            <View className="px-3 py-3">
              <Text className="font-sans-md text-[11px] uppercase tracking-[0.22em] text-accent">
                {item.handle.replace(/-/g, ' ')}
              </Text>
              <Text className="mt-1 font-sans-semibold text-[16px] leading-5 text-ink" numberOfLines={2}>
                {item.title}
              </Text>
            </View>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

export const HomeCategoryRail = memo(HomeCategoryRailInner);
