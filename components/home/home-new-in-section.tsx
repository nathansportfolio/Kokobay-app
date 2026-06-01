import { Link } from 'expo-router';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { HomeProductCarousel } from '@/components/home/home-product-carousel';
import { HomeSectionTitle } from '@/components/home/home-section-title';
import { Text } from '@/components/ui/text';
import type { Href } from 'expo-router';
import type { Product } from '@/types/shopify';

type Props = {
  products: Product[];
  tileWidth: number;
  carouselHeight: number;
  viewAllHref: Href;
};

function HomeNewInSectionInner({ products, tileWidth, carouselHeight, viewAllHref }: Props) {
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <HomeSectionTitle title="Latest arrivals" />
      <View style={{ height: carouselHeight, marginTop: 8 }}>
        {products.length === 0 ? (
          <Text variant="caption" className="text-mist">
            New arrivals will show here when products are available.
          </Text>
        ) : (
          <HomeProductCarousel products={products} tileWidth={tileWidth} />
        )}
      </View>
      <Link href={viewAllHref} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all new in products"
          style={{ marginTop: 16, alignSelf: 'flex-start', paddingVertical: 8 }}
          className="active:opacity-70">
          <Text variant="label" className="text-accent">
            View all
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

export const HomeNewInSection = memo(HomeNewInSectionInner);
