import { Link } from 'expo-router';
import { memo, useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { HomeSectionTitle } from '@/components/home/home-section-title';
import { ProductCardCarousel } from '@/components/ui/product-card-carousel';
import { Text } from '@/components/ui/text';
import type { Href } from 'expo-router';
import type { Product } from '@/types/shopify';
import { PRODUCT_CARD_CAROUSEL_TILE_GAP } from '@/utils/product-carousel-layout';
import { productHref } from '@/utils/product-navigation';

/** Matches section title / “View all” inset — carousel breaks out with negative margin. */
const SECTION_HORIZONTAL_PAD = 20;

type Props = {
  products: Product[];
  tileWidth: number;
  carouselHeight: number;
  viewAllHref: Href;
};

function HomeNewInSectionInner({ products, tileWidth, carouselHeight, viewAllHref }: Props) {
  const productLinkFor = useCallback((handle: string) => productHref(handle), []);

  return (
    <View style={{ paddingHorizontal: SECTION_HORIZONTAL_PAD }}>
      <HomeSectionTitle title="Latest arrivals" />
      <View
        style={{
          height: carouselHeight,
          marginTop: 8,
          marginHorizontal: -SECTION_HORIZONTAL_PAD,
        }}>
        {products.length === 0 ? (
          <Text variant="caption" className="px-5 text-mist">
            New arrivals will show here when products are available.
          </Text>
        ) : (
          <ProductCardCarousel
            products={products}
            tileWidth={tileWidth}
            tileGap={PRODUCT_CARD_CAROUSEL_TILE_GAP}
            contentPaddingEnd={SECTION_HORIZONTAL_PAD}
            productLinkFor={productLinkFor}
            perfTraceScreen="home"
            selectItemContext={{
              source_screen: 'home',
              item_list_id: 'home',
              item_list_name: 'Home',
            }}
          />
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
