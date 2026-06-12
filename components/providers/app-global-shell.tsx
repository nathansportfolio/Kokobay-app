import { usePathname, useSegments } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeaderBannerStack } from '@/components/cms/app-header-banner-stack';
import { LuxuryTabHeader } from '@/components/navigation/luxury-tab-header';
import { luxuryTabHeaderBarBottom } from '@/constants/luxury-nav';

const TAB_HEADER_Z_INDEX = 10_000;
const TAB_BANNER_Z_INDEX = 10_001;

/**
 * Tab routes use a fixed Koko Bay header; the incident strip is pinned just below it
 * so it stays above scrolling native lists (FlashList) that ignore sibling z-index.
 *
 * Header/banner chrome lives here on iOS — not inside NativeTabs. Tab content stays
 * full-bleed; each screen clears chrome with its own spacer.
 */
export function AppGlobalShell({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const segments = useSegments();
  const isTabScene = segments[0] === '(tabs)';
  const hideTabChrome = pathname === '/search-overlay';
  const bannerTop = luxuryTabHeaderBarBottom(insets.top);

  return (
    <View style={styles.root} pointerEvents="box-none" collapsable={false}>
      {children}
      {isTabScene && Platform.OS === 'ios' && !hideTabChrome ? (
        <View style={styles.headerHost} pointerEvents="box-none">
          <LuxuryTabHeader />
        </View>
      ) : null}
      {isTabScene && !hideTabChrome ? (
        <View
          pointerEvents="box-none"
          style={[styles.bannerHost, { top: bannerTop }]}>
          <AppHeaderBannerStack />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: TAB_HEADER_Z_INDEX,
    elevation: TAB_HEADER_Z_INDEX,
  },
  bannerHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: TAB_BANNER_Z_INDEX,
    elevation: TAB_BANNER_Z_INDEX,
  },
});
