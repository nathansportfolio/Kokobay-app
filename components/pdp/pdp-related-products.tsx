import { useMemo } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { ProductCard } from '@/components/ui/product-card';
import { Text } from '@/components/ui/text';
import type { Product } from '@/types/shopify';

export type PdpRelatedProductsProps = {
  products: Product[];
};

export function PdpRelatedProducts({ products }: PdpRelatedProductsProps) {
  const { width } = useWindowDimensions();
  const itemW = Math.min(200, Math.round(width * 0.42));

  const contentStyle = useMemo(
    () => ({
      paddingRight: 24,
    }),
    [],
  );

  if (products.length === 0) {
    return null;
  }

  return (
    <View className="mb-14 mt-12 border-t border-black/[0.06] pt-12">
      <Text variant="label" className="mb-6 text-[11px] uppercase tracking-[0.2em] text-muted">
        You may also like
      </Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerStyle={contentStyle}>
        {products.map((product) => (
          <View key={`${product.handle}:${product.id}`} style={{ width: itemW }} className="mr-4">
            <ProductCard product={product} tileWidth={itemW} perfTraceScreen="pdp-related" />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
