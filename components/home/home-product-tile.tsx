import { Link, useRouter } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { Text } from '@/components/ui/text';
import { usePrefetchProduct } from '@/hooks/use-prefetch-product';
import { useProductHref } from '@/hooks/use-product-href';
import { trackSelectItem } from '@/lib/gtm';
import type { SelectItemSourceScreen } from '@/lib/gtm/types';
import type { Product } from '@/types/shopify';
import { firstValidProductImage } from '@/utils/catalog-image';
import { formatMoney } from '@/utils/money';
import { productTileImageUri } from '@/utils/product-tile-image-uri';
import { cn } from '@/utils/cn';

export type HomeProductTileSelectItemContext = {
  source_screen: SelectItemSourceScreen;
  item_list_id: string;
  item_list_name: string;
  search_term?: string;
};

type Props = {
  product: Product;
  width: number;
  index?: number;
  /** When set, navigation uses this instead of the default in-tab `Link` (e.g. dismiss search modal first). */
  onProductPress?: (handle: string) => void;
  selectItemContext?: HomeProductTileSelectItemContext;
};

function HomeProductTileInner({ product, width, index, onProductPress, selectItemContext }: Props) {
  const prefetch = usePrefetchProduct();
  const router = useRouter();
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
  const compact = width < 180;
  const usesProgrammaticNav = Boolean(selectItemContext || onProductPress);

  const handlePress = useCallback(() => {
    if (selectItemContext) {
      trackSelectItem({
        product,
        source_screen: selectItemContext.source_screen,
        item_list_id: selectItemContext.item_list_id,
        item_list_name: selectItemContext.item_list_name,
        index,
        search_term: selectItemContext.search_term,
      });
    }
    if (onProductPress) {
      onProductPress(product.handle);
      return;
    }
    router.push(productLink);
  }, [index, onProductPress, product, productLink, router, selectItemContext]);

  const inner = (
    <Pressable
      onPressIn={() => prefetch(product.handle, sourceImage)}
      onPress={usesProgrammaticNav ? handlePress : undefined}
      style={{ width }}
      className={cn(
        'overflow-hidden border border-line/50 bg-warmSurface/80 active:opacity-88',
        compact ? 'mr-2 rounded-xl' : 'mr-4 rounded-2xl',
      )}>
      <View className="relative w-full overflow-hidden bg-elevated" style={{ aspectRatio: 3 / 4 }}>
        {uri ? <CatalogCoverImage uri={uri} recyclingKey={product.id} /> : null}
      </View>
      <View className={cn(compact ? 'gap-0.5 px-2 py-2' : 'gap-1 px-3.5 py-3')}>
        <Text
          className={cn(
            'font-sans-md text-ink',
            compact ? 'text-[12px] leading-4 tracking-[-0.1px]' : 'text-[15px] leading-5 tracking-[-0.15px]',
          )}
          numberOfLines={2}>
          {product.title}
        </Text>
        <Text
          variant="caption"
          className={cn(
            'font-sans-md uppercase text-mist',
            compact ? 'text-[10px] tracking-[0.1em]' : 'text-[12px] tracking-[0.12em]',
          )}>
          {price}
        </Text>
      </View>
    </Pressable>
  );

  if (usesProgrammaticNav) {
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
    prev.index === next.index &&
    prev.onProductPress === next.onProductPress &&
    prev.selectItemContext?.source_screen === next.selectItemContext?.source_screen &&
    prev.selectItemContext?.item_list_id === next.selectItemContext?.item_list_id &&
    prev.selectItemContext?.item_list_name === next.selectItemContext?.item_list_name &&
    prev.selectItemContext?.search_term === next.selectItemContext?.search_term &&
    prev.product.title === next.product.title &&
    prev.product.priceRange.minVariantPrice.amount === next.product.priceRange.minVariantPrice.amount,
);

HomeProductTile.displayName = 'HomeProductTile';
