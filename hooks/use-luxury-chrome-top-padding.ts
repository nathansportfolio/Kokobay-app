import {
  LUXURY_TAB_HEADER_CONTENT_GAP,
  luxuryHeaderTotalHeight,
  luxuryTabPlpListHeaderPaddingTop,
} from '@/constants/luxury-nav';
import { useOptionalBottomTabBarHeight } from '@/hooks/use-optional-bottom-tab-bar-height';

/** True when the screen sits inside the bottom tab navigator (shows `LuxuryTabHeader`). */
function useShowsLuxuryTabHeader(): boolean {
  return useOptionalBottomTabBarHeight() > 0;
}

/** PLP scroll header offset — full tab chrome on tab routes, safe-area gap on root stack. */
export function useLuxuryPlpListHeaderPaddingTop(bannerStripHeight = 0): number {
  if (useShowsLuxuryTabHeader()) {
    return luxuryTabPlpListHeaderPaddingTop(bannerStripHeight);
  }
  return bannerStripHeight + LUXURY_TAB_HEADER_CONTENT_GAP;
}

/** PDP / hero top inset — tab bar + brand header on tabs, status bar only on root stack. */
export function useLuxuryHeaderTotalHeight(topInset: number, bannerStripHeight = 0): number {
  if (useShowsLuxuryTabHeader()) {
    return luxuryHeaderTotalHeight(topInset, bannerStripHeight);
  }
  return topInset + bannerStripHeight + LUXURY_TAB_HEADER_CONTENT_GAP;
}
