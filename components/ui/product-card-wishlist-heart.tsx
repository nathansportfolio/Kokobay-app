import { memo, useCallback } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  LuxuryCardActionSurface,
  type LuxuryCardActionSize,
} from '@/components/ui/luxury-card-action-surface';
import { useIsWishlistedHandle, useWishlistToggle } from '@/contexts/wishlist-context';
import { palette } from '@/constants/theme';
import { hapticLight } from '@/utils/haptics';

const easeOutCubic = Easing.out(Easing.cubic);

type Props = {
  handle: string;
  actionSize: LuxuryCardActionSize;
  iconSize: number;
  inset: number;
};

function ProductCardWishlistHeartInner({ handle, actionSize, iconSize, inset }: Props) {
  const wishlisted = useIsWishlistedHandle(handle);
  const toggleWishlist = useWishlistToggle();
  const heartPressed = useSharedValue(0);
  const heartPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(heartPressed.value, [0, 1], [1, 0.96]) }],
    opacity: interpolate(heartPressed.value, [0, 1], [1, 0.92]),
  }));

  const onHeartPress = useCallback(() => {
    hapticLight();
    toggleWishlist(handle);
  }, [handle, toggleWishlist]);

  return (
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
      style={{ position: 'absolute', right: inset, top: inset, zIndex: 10 }}>
      <Animated.View style={heartPressStyle}>
        <LuxuryCardActionSurface size={actionSize}>
          <IconSymbol
            name={wishlisted ? 'heart.fill' : 'heart'}
            size={iconSize}
            color={wishlisted ? palette.accent : palette.ink}
            weight="regular"
          />
        </LuxuryCardActionSurface>
      </Animated.View>
    </Pressable>
  );
}

export const ProductCardWishlistHeart = memo(
  ProductCardWishlistHeartInner,
  (prev, next) =>
    prev.handle === next.handle &&
    prev.actionSize === next.actionSize &&
    prev.iconSize === next.iconSize &&
    prev.inset === next.inset,
);

ProductCardWishlistHeart.displayName = 'ProductCardWishlistHeart';
