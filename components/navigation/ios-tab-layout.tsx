/**
 * iOS NativeTabs — Liquid Glass on iOS 26+, native UITabBar on older versions.
 * Must be the layout root (no wrapping View or sibling overlays) so native tab
 * screens receive touches. Koko Bay chrome lives in `AppGlobalShell`.
 */
import { NativeTabs, Badge, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useMemo } from 'react';
import { DynamicColorIOS } from 'react-native';

import { useBagState } from '@/contexts/bag-context';
import { useWishlist } from '@/contexts/wishlist-context';
import { useRenderTrace } from '@/hooks/use-render-trace';

const TAB_LIGHT_TINT = 'rgba(36, 34, 31, 0.92)';
const TAB_DARK_TINT = 'rgba(250, 248, 246, 0.92)';
const TAB_LIGHT_ICON = 'rgba(92, 91, 88, 0.48)';
const TAB_DARK_ICON = 'rgba(250, 248, 246, 0.48)';
const CART_TAB_SELECTED_COLOR = '#8A7E72';

function iosTabColors() {
  return {
    tint: DynamicColorIOS({ light: TAB_LIGHT_TINT, dark: TAB_DARK_TINT }),
    icon: DynamicColorIOS({ light: TAB_LIGHT_ICON, dark: TAB_DARK_ICON }),
  };
}

export default function IOSTabLayout() {
  useRenderTrace('BottomTabs');
  const { bagUnitCount } = useBagState();
  const { wishlistCount } = useWishlist();
  const tabColors = useMemo(iosTabColors, []);

  const cartBadge =
    bagUnitCount > 0 ? String(Math.min(bagUnitCount, 99)) : undefined;
  const cartSelectedColor =
    bagUnitCount > 0 ? CART_TAB_SELECTED_COLOR : undefined;
  const wishlistSfIcon =
    wishlistCount > 0
      ? ({ default: 'heart.fill' as const, selected: 'heart.fill' as const })
      : ({ default: 'heart' as const, selected: 'heart.fill' as const });

  return (
    <NativeTabs
      backgroundColor={null}
      blurEffect="systemChromeMaterial"
      tintColor={tabColors.tint}
      iconColor={tabColors.icon}
      labelVisibilityMode="unlabeled">
      <NativeTabs.Trigger name="index">
        <Label hidden>Home</Label>
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="categories">
        <Label hidden>Categories</Label>
        <Icon sf={{ default: 'list.bullet', selected: 'list.bullet' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cart">
        <Label hidden>Cart</Label>
        <Icon
          sf={{ default: 'bag', selected: 'bag.fill' }}
          selectedColor={cartSelectedColor}
        />
        {cartBadge ? <Badge>{cartBadge}</Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wishlist">
        <Label hidden>Wishlist</Label>
        <Icon sf={wishlistSfIcon} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <Label hidden>Account</Label>
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
