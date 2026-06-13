import { memo, useCallback, useMemo } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';

import { ProductCard } from '@/components/ui/product-card';
import { usePrefetchProduct } from '@/hooks/use-prefetch-product';
import { Text } from '@/components/ui/text';
import type { Product } from '@/types/shopify';
import { pdpRelatedProductReturnTo, productHref } from '@/utils/product-navigation';

export type PdpRelatedProductsProps = {
  products: Product[];
  /** Original PLP path — preserved when replacing between related PDPs. */
  returnTo?: string;
};

type RelatedProductCardProps = {
  product: Product;
  tileWidth: number;
  tileIndex: number;
  returnTo?: string;
  onPrefetchProduct: ReturnType<typeof usePrefetchProduct>;
};

const RelatedProductCard = memo(function RelatedProductCard({
  product,
  tileWidth,
  tileIndex,
  returnTo,
  onPrefetchProduct,
}: RelatedProductCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const link = useMemo(
    () => productHref(product.handle, pdpRelatedProductReturnTo(pathname, returnTo)),
    [product.handle, pathname, returnTo],
  );
  const onProductPress = useCallback(() => {
    router.push(link as Href);
  }, [router, link]);

  return (
    <ProductCard
      product={product}
      tileWidth={tileWidth}
      perfTraceScreen="pdp-related"
      productLink={link}
      isVisible
      onProductPress={onProductPress}
      onPrefetchProduct={onPrefetchProduct}
      selectItemContext={{
        source_screen: 'related_products',
        item_list_id: 'related_products',
        item_list_name: 'You may also like',
        index: tileIndex,
      }}
    />
  );
});

export function PdpRelatedProducts({ products, returnTo }: PdpRelatedProductsProps) {
  const { width } = useWindowDimensions();
  const prefetchProduct = usePrefetchProduct();
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
        {products.map((product, index) => (
          <View key={`${product.handle}:${product.id}`} style={{ width: itemW }} className="mr-4">
            <RelatedProductCard
              product={product}
              tileWidth={itemW}
              tileIndex={index}
              returnTo={returnTo}
              onPrefetchProduct={prefetchProduct}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
