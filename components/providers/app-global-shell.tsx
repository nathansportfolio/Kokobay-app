import { useSegments } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeaderBannerStack } from '@/components/cms/app-header-banner-stack';
import { luxuryTabHeaderBarBottom } from '@/constants/luxury-nav';

const TAB_BANNER_Z_INDEX = 9999;

/**
 * Tab routes use a fixed Koko Bay header; the incident strip is pinned just below it
 * so it stays above scrolling native lists (FlashList) that ignore sibling z-index.
 */
export function AppGlobalShell({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const isTabScene = segments[0] === '(tabs)';
  const bannerTop = luxuryTabHeaderBarBottom(insets.top);

  return (
    <View style={styles.root}>
      {children}
      {isTabScene ? (
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
  bannerHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: TAB_BANNER_Z_INDEX,
    elevation: TAB_BANNER_Z_INDEX,
  },
});
