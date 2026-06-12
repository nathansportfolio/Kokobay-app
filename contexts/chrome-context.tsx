import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { usePathname } from 'expo-router';
import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';
import { Platform } from 'react-native';

import {
  LUXURY_TAB_CONTENT_EXTRA_BOTTOM,
  LUXURY_TAB_HEADER_CONTENT_GAP,
  luxuryHeaderTotalHeight,
  luxuryTabHeaderBarBottom,
} from '@/constants/luxury-nav';
import { useAppErrorBannerChromeHeight } from '@/hooks/use-app-error-banner-content';
import { useStableBottomInset, useStableTopInset } from '@/hooks/use-stable-top-inset';
import { isTabRoutePathname } from '@/lib/tab-route-pathname';

/** UITabBar chrome above the home indicator — iOS NativeTabs does not expose measured height. */
const IOS_NATIVE_TAB_BAR_CHROME = 56;

export type ChromeContextValue = {
  /** Bottom edge of fixed top chrome (status bar + Koko Bay row + promo/incident strips). */
  topChromeHeight: number;
  /** Tab bar stack height for full-bleed tab scenes (bar + home indicator on iOS). */
  bottomChromeHeight: number;
  /** Seeded status-bar inset — overlay header `paddingTop`. */
  topInset: number;
  /** Y offset for the banner host below the Koko Bay row. */
  tabHeaderBottom: number;
  /** Fixed tab header + banner overlays are active on this route. */
  showsTabChrome: boolean;
};

const ChromeContext = createContext<ChromeContextValue | null>(null);

function measureBottomChromeHeight(
  measuredTabBar: number | undefined,
  bottomInset: number,
): number {
  if (Platform.OS === 'ios') {
    const nativeTabsStack = IOS_NATIVE_TAB_BAR_CHROME + bottomInset;
    const reported = typeof measuredTabBar === 'number' ? measuredTabBar : 0;
    return Math.max(reported, nativeTabsStack);
  }

  if (typeof measuredTabBar === 'number' && measuredTabBar > 0) {
    return measuredTabBar;
  }

  return 0;
}

export function ChromeProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const topInset = useStableTopInset();
  const bottomInset = useStableBottomInset();
  const bannerStripHeight = useAppErrorBannerChromeHeight();
  const measuredTabBar = useContext(BottomTabBarHeightContext);

  const showsTabChrome = isTabRoutePathname(pathname);

  const value = useMemo((): ChromeContextValue => {
    const tabHeaderBottom = luxuryTabHeaderBarBottom(topInset);
    const topChromeHeight = showsTabChrome
      ? luxuryHeaderTotalHeight(topInset, bannerStripHeight)
      : topInset;
    const bottomChromeHeight = showsTabChrome
      ? measureBottomChromeHeight(measuredTabBar, bottomInset)
      : 0;

    return {
      topChromeHeight,
      bottomChromeHeight,
      topInset,
      tabHeaderBottom,
      showsTabChrome,
    };
  }, [
    bannerStripHeight,
    bottomInset,
    measuredTabBar,
    showsTabChrome,
    topInset,
  ]);

  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

export function useChrome(): ChromeContextValue {
  const ctx = useContext(ChromeContext);
  if (!ctx) {
    throw new Error('useChrome must be used within ChromeProvider');
  }
  return ctx;
}

/** Scroll/list top spacer — fixed chrome clearance plus editorial gap. */
export function useScrollTopPadding(): number {
  const { topChromeHeight } = useChrome();
  return topChromeHeight + LUXURY_TAB_HEADER_CONTENT_GAP;
}

/** Scroll/list `paddingBottom` — tab bar height plus route-specific gap. */
export function useScrollBottomPadding(extraPad: number): number {
  const { bottomChromeHeight } = useChrome();
  return bottomChromeHeight + extraPad;
}

/**
 * Bottom inset for floating chrome (PDP add-to-bag, cart checkout card).
 * iOS NativeTabs scenes are full-bleed behind the glass tab bar; Android JS tabs sit above it.
 */
export function useFloatingBottomPadding(): number {
  const { bottomChromeHeight } = useChrome();
  const bottomInset = useStableBottomInset();

  if (Platform.OS === 'ios') {
    return bottomChromeHeight + LUXURY_TAB_CONTENT_EXTRA_BOTTOM;
  }

  if (bottomChromeHeight > 0) {
    return LUXURY_TAB_CONTENT_EXTRA_BOTTOM;
  }

  return Math.max(bottomInset, 8) + LUXURY_TAB_CONTENT_EXTRA_BOTTOM;
}
