import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useContext } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LUXURY_TAB_CONTENT_EXTRA_BOTTOM } from '@/constants/luxury-nav';

/** UITabBar chrome above the home indicator — iOS NativeTabs / Liquid Glass does not expose measured height. */
const IOS_NATIVE_TAB_BAR_CHROME = 56;

/**
 * Tab bar height for bottom padding. Uses React Navigation context when available (JS tabs on Android/web).
 * On iOS NativeTabs, falls back to standard UITabBar chrome plus `useSafeAreaInsets().bottom`.
 */
export function useOptionalBottomTabBarHeight(): number {
  const measured = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'ios') {
    /** NativeTabs often reports tab bar height without the home-indicator inset — always floor it. */
    const nativeTabsStack = IOS_NATIVE_TAB_BAR_CHROME + insets.bottom;
    const reported = typeof measured === 'number' ? measured : 0;
    return Math.max(reported, nativeTabsStack);
  }

  if (typeof measured === 'number' && measured > 0) {
    return measured;
  }

  return 0;
}

/**
 * Bottom inset for floating tab chrome (PDP add-to-bag, cart checkout card).
 * iOS NativeTabs scenes are full-bleed behind the glass tab bar; Android JS tabs sit above it.
 */
export function useLuxuryTabContentBottomPadding(): number {
  const tabBarHeight = useOptionalBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'ios') {
    return tabBarHeight + LUXURY_TAB_CONTENT_EXTRA_BOTTOM;
  }

  if (tabBarHeight > 0) {
    return LUXURY_TAB_CONTENT_EXTRA_BOTTOM;
  }

  return Math.max(insets.bottom, 8) + LUXURY_TAB_CONTENT_EXTRA_BOTTOM;
}
