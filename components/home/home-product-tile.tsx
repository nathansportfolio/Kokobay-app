import { Link } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { Text } from '@/components/ui/text';
import { usePrefetchProduct } from '@/hooks/use-prefetch-product';
import { useProductHref } from '@/hooks/use-product-href';
import type { Product } from '@/types/shopify';
import { firstValidProductImage } from '@/utils/catalog-image';
import { formatMoney } from '@/utils/money';
import { productTileImageUri } from '@/utils/product-tile-image-uri';
import { cn } from '@/utils/cn';

type Props = {
  product: Product;
  width: number;
  /** When set, navigation uses this instead of the default in-tab `Link` (e.g. dismiss search modal first). */
  onProductPress?: (handle: string) => void;
};

function HomeProductTileInner({ product, width, onProductPress }: Props) {
  const prefetch = usePrefetchProduct();
  const productLink = useProductHref(product.handle);
  const sourceImage = firstValidProductImage(product);
  const uri = useMemo(() => {
    if (!sourceImage) return undefined;
    return productTileImageUri({
      url: sourceImage.url,
      width: sourceImage.width,
      height: sourceImage.height,
      tileWidth: width,
      handle: product.handle,
    });
  }, [product.handle, sourceImage, width]);
  const price = formatMoney(product.priceRange.minVariantPrice);

  const pressableProps = onProductPress
    ? { onPress: () => onProductPress(product.handle) }
    : {};

  const inner = (
    <Pressable
      onPressIn={() => prefetch(product.handle, sourceImage)}
      {...pressableProps}
      style={{ width }}
      className={cn(
        'mr-4 overflow-hidden rounded-2xl border border-line/50 bg-warmSurface/80 active:opacity-88',
      )}>
      <View className="relative w-full overflow-hidden bg-elevated" style={{ aspectRatio: 3 / 4 }}>
        {uri ? <CatalogCoverImage uri={uri} recyclingKey={product.id} /> : null}
      </View>
      <View className="gap-1 px-3.5 py-3">
        <Text className="font-sans-md text-[15px] leading-5 tracking-[-0.15px] text-ink" numberOfLines={2}>
          {product.title}
        </Text>
        <Text variant="caption" className="font-sans-md text-[12px] uppercase tracking-[0.12em] text-mist">
          {price}
        </Text>
      </View>
    </Pressable>
  );

  if (onProductPress) {
    return inner;
  }

  return (
    <Link href={productLink} asChild>
      {inner}
    </Link>
  );
}

export const HomeProductTile = memo(
  HomeProductTileInner,
  (prev, next) =>
    prev.product.id === next.product.id &&
    prev.width === next.width &&
    prev.onProductPress === next.onProductPress &&
    prev.product.title === next.product.title &&
    prev.product.priceRange.minVariantPrice.amount === next.product.priceRange.minVariantPrice.amount,
);

HomeProductTile.displayName = 'HomeProductTile';
