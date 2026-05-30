import { Link } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { QuickAddToBag } from '@/components/cart/quick-add-to-bag';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LuxuryCardActionSurface } from '@/components/ui/luxury-card-action-surface';
import { useShopLists } from '@/contexts/shop-lists-context';
import { palette } from '@/constants/theme';
import { usePrefetchProduct } from '@/hooks/use-prefetch-product';
import { useProductHref } from '@/hooks/use-product-href';
import { logPlpFirstImageLoad } from '@/lib/plp-perf-trace';
import type { Product } from '@/types/shopify';
import { firstValidProductImage } from '@/utils/catalog-image';
import { productCardTypoPreset } from '@/constants/product-card-typography';
import { cn } from '@/utils/cn';
import { isProductFullySoldOut } from '@/utils/product-availability';
import { hapticLight } from '@/utils/haptics';
import { formatMoney } from '@/utils/money';
import { productTileImageUri } from '@/utils/product-tile-image-uri';

import { CatalogCoverImage } from './catalog-cover-image';
import { Text } from './text';

const easeOutCubic = Easing.out(Easing.cubic);
const IMAGE_PRESS_MS = { in: 160, out: 220 } as const;
const TITLE_PRESS_MS = { in: 120, out: 200 } as const;

export type ProductCardProps = {
  product: Product;
  className?: string;
  /** De-prioritize decoding when many tiles are on screen (e.g. collection grid). */
  imagePriority?: 'low' | 'normal' | 'high' | null;
  /**
   * Collection/search PLP grid density — single column uses larger type to match the wider tile.
   * @default 2
   */
  gridColumns?: 1 | 2;
  /** Logical tile width (points) — sizes Shopify CDN delivery. */
  tileWidth?: number;
  /** Dev perf — log first visible tile image (`0` only). */
  perfTraceIndex?: number;
  perfTraceScreen?: string;
  disableImageTransition?: boolean;
};

function ProductCardInner({
  product,
  className,
  imagePriority,
  gridColumns = 2,
  tileWidth,
  perfTraceIndex,
  perfTraceScreen = 'plp',
  disableImageTransition = true,
}: ProductCardProps) {
  const prefetch = usePrefetchProduct();
  const productLink = useProductHref(product.handle);
  const sourceImage = firstValidProductImage(product);
  const imageUrl = useMemo(() => {
    if (!sourceImage) return undefined;
    return productTileImageUri({
      url: sourceImage.url,
      width: sourceImage.width,
      height: sourceImage.height,
      tileWidth,
      handle: product.handle,
    });
  }, [product.handle, sourceImage, tileWidth]);
  const priceLabel = formatMoney(product.priceRange.minVariantPrice);
  const { wishlistHandles, toggleWishlist } = useShopLists();
  const wishlisted = wishlistHandles.includes(product.handle);
  const soldOut = isProductFullySoldOut(product);
  const heartPressed = useSharedValue(0);
  const heartPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(heartPressed.value, [0, 1], [1, 0.96]) }],
    opacity: interpolate(heartPressed.value, [0, 1], [1, 0.92]),
  }));
  const imagePressed = useSharedValue(0);
  const imagePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(imagePressed.value, [0, 1], [1, 1.018]) }],
    opacity: interpolate(imagePressed.value, [0, 1], [1, 0.94]),
  }));
  const titlePressed = useSharedValue(0);
  const titlePressStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titlePressed.value, [0, 1], [1, 0.92]),
  }));

  const onHeartPress = useCallback(() => {
    hapticLight();
    toggleWishlist(product.handle);
  }, [product.handle, toggleWishlist]);

  const imageInner = imageUrl ? (
    <CatalogCoverImage
      uri={imageUrl}
      recyclingKey={product.id}
      priority={imagePriority}
      transition={disableImageTransition ? null : undefined}
      onLoad={
        perfTraceIndex === 0
          ? () => {
              logPlpFirstImageLoad(perfTraceScreen, {
                handle: product.handle,
                productId: product.id,
                imageUrl,
              });
            }
          : undefined
      }
    />
  ) : null;

  const comfort = gridColumns === 1;
  const actionSize = comfort ? 'md' : 'sm';
  const typo = productCardTypoPreset(gridColumns);

  const titleBlock = (
    <Animated.View style={titlePressStyle}>
      <View
        className="w-full"
        style={{
          gap: typo.gap,
          paddingTop: typo.paddingTop,
          paddingBottom: typo.paddingBottom,
          paddingHorizontal: typo.paddingHorizontal,
        }}>
        <Text
          numberOfLines={2}
          className="font-sans-md text-ink"
          style={{
            fontSize: typo.titleFontSize,
            lineHeight: typo.titleLineHeight,
          }}>
          {product.title}
        </Text>
        <Text
          numberOfLines={1}
          className="font-sans-md text-ink"
          style={{
            fontSize: typo.priceFontSize,
            lineHeight: typo.priceLineHeight,
          }}>
          {priceLabel}
        </Text>
      </View>
    </Animated.View>
  );

  return (
    <View className={cn('bg-transparent', className)}>
      <View className="relative aspect-[3/4] w-full overflow-hidden bg-elevated">
        <Link href={productLink} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={soldOut ? `${product.title}, no stock` : product.title}
            onPressIn={() => {
              imagePressed.value = withTiming(1, {
                duration: IMAGE_PRESS_MS.in,
                easing: easeOutCubic,
              });
              prefetch(product.handle, sourceImage);
            }}
            onPressOut={() => {
              imagePressed.value = withTiming(0, {
                duration: IMAGE_PRESS_MS.out,
                easing: easeOutCubic,
              });
            }}
            className="absolute inset-0">
            <Animated.View className="absolute inset-0" style={imagePressStyle}>
              {imageInner}
            </Animated.View>
          </Pressable>
        </Link>
        {soldOut ? (
          <View
            pointerEvents="none"
            className="absolute left-1.5 top-1.5 z-10 rounded px-2 py-1"
            style={{
              backgroundColor: 'rgba(255,255,255,0.92)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}>
            <Text
              variant="caption"
              className={cn(
                'font-medium uppercase tracking-[0.14em]',
                comfort ? 'text-[10px]' : 'text-[8px]',
              )}
              style={{ color: palette.ink }}>
              Sold out
            </Text>
          </View>
        ) : null}
        <Pressable
          onPressIn={() => {
            heartPressed.value = withTiming(1, { duration: 110, easing: easeOutCubic });
          }}
          onPressOut={() => {
            heartPressed.value = withTiming(0, { duration: 200, easing: easeOutCubic });
          }}
          onPress={onHeartPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          accessibilityState={{ selected: wishlisted }}
          className="absolute right-4 top-4 z-10">
          <Animated.View style={heartPressStyle}>
            <LuxuryCardActionSurface size={actionSize}>
              <IconSymbol
                name={wishlisted ? 'heart.fill' : 'heart'}
                size={18}
                color={wishlisted ? palette.accent : palette.ink}
                weight="regular"
              />
            </LuxuryCardActionSurface>
          </Animated.View>
        </Pressable>
        {!soldOut ? <QuickAddToBag product={product} relaxed={comfort} /> : null}
      </View>
      <Link href={productLink} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={soldOut ? `${product.title}, title and price, no stock` : undefined}
          onPressIn={() => {
            titlePressed.value = withTiming(1, {
              duration: TITLE_PRESS_MS.in,
              easing: easeOutCubic,
            });
            prefetch(product.handle, sourceImage);
          }}
          onPressOut={() => {
            titlePressed.value = withTiming(0, {
              duration: TITLE_PRESS_MS.out,
              easing: easeOutCubic,
            });
          }}>
          {titleBlock}
        </Pressable>
      </Link>
    </View>
  );
}

export const ProductCard = memo(ProductCardInner);

ProductCard.displayName = 'ProductCard';
