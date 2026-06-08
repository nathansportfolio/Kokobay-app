import { Tabs } from 'expo-router';
import { Heart, House, LayoutList, ShoppingBag, User } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, type TextStyle, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { useRenderTrace } from '@/hooks/use-render-trace';
import { LuxuryTabHeader } from '@/components/navigation/luxury-tab-header';
import { useBagState } from '@/contexts/bag-context';
import { useWishlist } from '@/contexts/wishlist-context';
import { LUXURY_SYMBOL } from '@/constants/luxury-icons';
import { palette } from '@/constants/theme';

function tabIconStrokeWidth(focused: boolean) {
  return focused ? 1.78 : 1.22;
}

/** Bag outline when the tab has items — no fill (filled Lucide bag reads oddly at small sizes). */
const BAG_TAB_BORDER_BEIGE = '#8A7E72';

/** Cart count badge — compact, muted (luxury tone vs. bright retail red). */
const CART_BADGE_DIAM = 17;
const cartBadgeStyle: TextStyle = {
  backgroundColor: '#8E6E66',
  color: '#FAF8F6',
  fontFamily: 'InstrumentSans-Medium',
  fontSize: 9,
  width: CART_BADGE_DIAM,
  height: CART_BADGE_DIAM,
  lineHeight: Platform.OS === 'ios' ? CART_BADGE_DIAM : CART_BADGE_DIAM - 2,
  borderRadius: CART_BADGE_DIAM / 2,
  overflow: 'hidden',
  textAlign: 'center',
  textAlignVertical: 'center',
  paddingHorizontal: 0,
  paddingVertical: 0,
  ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
};

export default function TabLayout() {
  useRenderTrace('BottomTabs');
  const { bagUnitCount } = useBagState();
  const { wishlistCount } = useWishlist();

  const cartBadge = useMemo(() => {
    if (bagUnitCount <= 0) return undefined;
    /** Cap at 99 so the badge stays a single-line circle (no “99+” pill). */
    return Math.min(bagUnitCount, 99);
  }, [bagUnitCount]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <Tabs
          screenOptions={{
            headerShown: false,
            freezeOnBlur: false,
            sceneStyle: { flex: 1, backgroundColor: palette.canvas },
            tabBarButton: HapticTab,
            tabBarStyle: {
              backgroundColor: palette.canvas,
              borderTopWidth: 0,
              elevation: 0,
              shadowColor: '#2C2925',
              shadowOffset: { width: 0, height: -1 },
              shadowOpacity: 0.045,
              shadowRadius: 14,
              /** Air above icons; omit paddingBottom so React Navigation keeps home-indicator inset. */
              paddingTop: 8,
            },
            tabBarShowLabel: false,
            tabBarActiveTintColor: 'rgba(36, 34, 31, 0.92)',
            tabBarInactiveTintColor: 'rgba(92, 91, 88, 0.48)',
            tabBarItemStyle: {
              paddingVertical: 10,
              /** Use full column width for taps — horizontal padding was shrinking each target. */
              paddingHorizontal: 0,
            },
            tabBarIconStyle: {
              marginTop: 0,
            },
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color, focused }) => (
                <House
                  size={LUXURY_SYMBOL.tabIconSize}
                  color={color}
                  strokeWidth={tabIconStrokeWidth(focused)}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="categories"
            options={{
              title: 'Collections',
              tabBarIcon: ({ color, focused }) => (
                <LayoutList
                  size={LUXURY_SYMBOL.tabIconSize}
                  color={color}
                  strokeWidth={tabIconStrokeWidth(focused)}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="search"
            options={{ href: null, headerShown: false, sceneStyle: { backgroundColor: palette.surface } }}
          />
          <Tabs.Screen
            name="collection/[handle]"
            options={{ href: null, headerShown: false, sceneStyle: { backgroundColor: palette.surface } }}
          />
          <Tabs.Screen
            name="product/[handle]"
            options={{ href: null, headerShown: false, sceneStyle: { backgroundColor: palette.canvas } }}
          />
          <Tabs.Screen
            name="cart"
            options={{
              title: 'Cart',
              tabBarBadge: cartBadge,
              tabBarBadgeStyle: cartBadgeStyle,
              tabBarIcon: ({ color, focused }) => (
                <ShoppingBag
                  size={LUXURY_SYMBOL.tabIconSize}
                  color={bagUnitCount > 0 ? BAG_TAB_BORDER_BEIGE : color}
                  strokeWidth={tabIconStrokeWidth(focused)}
                  fill="transparent"
                />
              ),
            }}
          />
          <Tabs.Screen
            name="wishlist"
            options={{
              title: 'Wishlist',
              tabBarIcon: ({ color, focused }) => (
                <Heart
                  size={LUXURY_SYMBOL.tabIconSize}
                  color={color}
                  strokeWidth={tabIconStrokeWidth(focused)}
                  fill={wishlistCount > 0 ? color : 'transparent'}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="account"
            options={{
              title: 'Account',
              tabBarIcon: ({ color, focused }) => (
                <User
                  size={LUXURY_SYMBOL.tabIconSize}
                  color={color}
                  strokeWidth={tabIconStrokeWidth(focused)}
                />
              ),
            }}
          />
          <Tabs.Screen name="login" options={{ href: null, headerShown: false }} />
          <Tabs.Screen name="register" options={{ href: null, headerShown: false }} />
          <Tabs.Screen name="forgot-password" options={{ href: null, headerShown: false }} />
          <Tabs.Screen
            name="checkout"
            options={{
              href: null,
              headerShown: false,
              tabBarStyle: { display: 'none' },
            }}
          />
      </Tabs>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <LuxuryTabHeader />
      </View>
    </View>
  );
}
