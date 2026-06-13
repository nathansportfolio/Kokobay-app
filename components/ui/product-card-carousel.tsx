import type { Href } from 'expo-router';
import { memo, useMemo } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';

import { ProductCard } from '@/components/ui/product-card';
import { usePrefetchProduct } from '@/hooks/use-prefetch-product';
import type { SelectItemSourceScreen } from '@/lib/gtm/types';
import type { Product } from '@/types/shopify';

export type ProductCardCarouselSelectItemContext = {
  source_screen: SelectItemSourceScreen;
  item_list_id: string;
  item_list_name: string;
  search_term?: string;
};

type Props = {
  products: Product[];
  tileWidth: number;
  /** Gap between cards in the horizontal rail. */
  tileGap?: number;
  /** Extra end padding so the last card can scroll off slightly. */
  contentPaddingEnd?: number;
  productLinkFor: (handle: string) => Href;
  onProductPress?: (handle: string) => void;
  selectItemContext?: ProductCardCarouselSelectItemContext;
  perfTraceScreen?: string;
};

function ProductCardCarouselInner({
  products,
  tileWidth,
  tileGap = 16,
  contentPaddingEnd = 0,
  productLinkFor,
  onProductPress,
  selectItemContext,
  perfTraceScreen = 'product-carousel',
}: Props) {
  const prefetch = usePrefetchProduct();

  const contentStyle = useMemo<StyleProp<ViewStyle>>(
    () => ({
      paddingLeft: 0,
      paddingRight: contentPaddingEnd,
      paddingBottom: 8,
    }),
    [contentPaddingEnd],
  );

  if (!products.length) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1 }}
      contentContainerStyle={contentStyle}>
      {products.map((item, index) => (
        <View
          key={`${item.handle}:${item.id}`}
          style={{
            width: tileWidth,
            marginRight: index === products.length - 1 ? 0 : tileGap,
          }}>
          <ProductCard
            product={item}
            productLink={productLinkFor(item.handle)}
            tileWidth={tileWidth}
            gridColumns={2}
            imagePriority="low"
            perfTraceIndex={index}
            perfTraceScreen={perfTraceScreen}
            isVisible
            onPrefetchProduct={prefetch}
            onProductPress={onProductPress ? () => onProductPress(item.handle) : undefined}
            selectItemContext={
              selectItemContext
                ? {
                    ...selectItemContext,
                    index,
                  }
                : undefined
            }
          />
        </View>
      ))}
    </ScrollView>
  );
}

export const ProductCardCarousel = memo(ProductCardCarouselInner);
