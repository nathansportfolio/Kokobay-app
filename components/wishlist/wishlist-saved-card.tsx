import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { type ReactNode, useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { QuickAddToBag } from '@/components/cart/quick-add-to-bag';
import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import {
  LUXURY_CARD_ACTION_ICON_COLOR,
  LuxuryCardActionSurface,
} from '@/components/ui/luxury-card-action-surface';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useProductHref } from '@/hooks/use-product-href';
import { trackSelectItem } from '@/lib/gtm';
import type { Product } from '@/types/shopify';
import { firstValidProductImage } from '@/utils/catalog-image';
import { hapticLight } from '@/utils/haptics';
import { formatMoney } from '@/utils/money';
import { productTileImageUri } from '@/utils/product-tile-image-uri';
import { isProductFullySoldOut } from '@/utils/product-availability';

const REMOVE_ICON = { strokeWidth: 1.75 as const };
const REMOVE_ICON_SIZE = 18;
const easeOutCubic = Easing.out(Easing.cubic);

export type WishlistSavedCardProps = {
  handle: string;
  product: Product | null | undefined;
  isPending: boolean;
  index: number;
  onRemove: (handle: string) => void;
  /** Column content width (grid cell minus horizontal gutters). */
  tileWidth: number;
  /** Fixed image column height (grid rows share one height in FlashList). */
  imageHeight: number;
};

const AnimatedImagePress = Animated.createAnimatedComponent(Pressable);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function WishlistSavedCardSkeleton({
  tileWidth,
  imageHeight,
  removeControl,
}: {
  tileWidth: number;
  imageHeight: number;
  removeControl: ReactNode;
}) {
  return (
    <View style={{ width: tileWidth }}>
      <View className="relative">
        <Skeleton
          className="rounded-2xl bg-warmElevated/85"
          style={{ width: tileWidth, height: imageHeight }}
        />
        {removeControl}
      </View>
      <Skeleton className="mt-2.5 h-3.5 w-[92%] rounded-sm bg-warmElevated/75" />
      <Skeleton className="mt-1.5 h-3 w-14 rounded-sm bg-warmElevated/65" />
    </View>
  );
}

export function WishlistSavedCard({
  handle,
  product,
  isPending,
  index,
  onRemove,
  tileWidth,
  imageHeight,
}: WishlistSavedCardProps) {
  const router = useRouter();
  const imagePressed = useSharedValue(0);
  const imagePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(imagePressed.value, [0, 1], [1, 1.018]) }],
    opacity: interpolate(imagePressed.value, [0, 1], [1, 0.94]),
  }));
  const removePressed = useSharedValue(0);
  const removePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(removePressed.value, [0, 1], [1, 0.96]) }],
    opacity: interpolate(removePressed.value, [0, 1], [1, 0.92]),
  }));
  const relaxed = tileWidth >= 176;
  const actionSize = relaxed ? 'md' : 'sm';

  const productLink = useProductHref(handle);
  const sourceImage = product ? firstValidProductImage(product) : undefined;
  const imageUrl = useMemo(() => {
    if (!sourceImage) return undefined;
    return productTileImageUri({
      url: sourceImage.url,
      width: sourceImage.width,
      height: sourceImage.height,
      tileWidth,
      handle: product?.handle ?? handle,
    });
  }, [sourceImage, tileWidth, product?.handle, handle]);
  const title = product?.title ?? handle.replace(/-/g, ' ');
  const priceLabel = product ? formatMoney(product.priceRange.minVariantPrice) : '';
  const isLoading = isPending || !product;

  const openProduct = useCallback(() => {
    if (!product) return;
    trackSelectItem({
      product,
      source_screen: 'wishlist',
      item_list_id: 'wishlist',
      item_list_name: 'Wishlist',
      index,
    });
    router.push(productLink);
  }, [index, product, productLink, router]);

  const removeControl = (
    <AnimatedPressable
      onPressIn={() => {
        removePressed.value = withTiming(1, { duration: 110, easing: easeOutCubic });
      }}
      onPressOut={() => {
        removePressed.value = withTiming(0, { duration: 200, easing: easeOutCubic });
      }}
      onPress={() => {
        hapticLight();
        onRemove(handle);
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Remove from wishlist"
      className="absolute right-[12px] top-[12px] z-10"
      style={removePressStyle}>
      <LuxuryCardActionSurface size={actionSize}>
        <X size={REMOVE_ICON_SIZE} color={LUXURY_CARD_ACTION_ICON_COLOR} {...REMOVE_ICON} />
      </LuxuryCardActionSurface>
    </AnimatedPressable>
  );

  if (isLoading) {
    return (
      <WishlistSavedCardSkeleton
        tileWidth={tileWidth}
        imageHeight={imageHeight}
        removeControl={removeControl}
      />
    );
  }

  return (
    <View>
      <View style={{ width: tileWidth }}>
        <View className="relative">
          <AnimatedImagePress
            onPress={openProduct}
            onPressIn={() => {
              imagePressed.value = withTiming(1, { duration: 160, easing: easeOutCubic });
            }}
            onPressOut={() => {
              imagePressed.value = withTiming(0, { duration: 220, easing: easeOutCubic });
            }}
            accessibilityRole="link"
            accessibilityLabel={`Open ${title}`}
            style={imagePressStyle}>
              <View
                className="w-full overflow-hidden rounded-2xl bg-warmElevated"
                style={{ width: tileWidth, height: imageHeight }}>
                {imageUrl ? (
                  <CatalogCoverImage
                    uri={imageUrl}
                    recyclingKey={handle}
                    priority="low"
                    transition={null}
                  />
                ) : (
                  <View className="h-full w-full bg-warmElevated" />
                )}
              </View>
            </AnimatedImagePress>
          {product && !isProductFullySoldOut(product) ? (
            <QuickAddToBag
              product={product}
              relaxed={relaxed}
              triggerClassName="bottom-[12px] left-[12px] z-[9]"
            />
          ) : null}
          {removeControl}
        </View>

        <Pressable className="mt-2.5" accessibilityRole="link" accessibilityLabel={title} onPress={openProduct}>
            <Text
              className="font-sans-md text-[15px] tracking-[-0.15px] text-ink"
              numberOfLines={2}
              style={{ lineHeight: 15 * 1.05 }}>
              {title}
            </Text>
            {priceLabel ? (
              <Text className="mt-1.5 font-sans-md text-[12px] uppercase tracking-[0.12em] text-mist">
                {priceLabel}
              </Text>
            ) : null}
        </Pressable>
      </View>
    </View>
  );
}
