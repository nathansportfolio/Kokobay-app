import {
  LUXURY_TAB_HEADER_CONTENT_GAP,
  luxuryHeaderTotalHeight,
} from '@/constants/luxury-nav';
import { useAppErrorBannerChromeHeight } from '@/hooks/use-app-error-banner-content';
import { useStableTopInset } from '@/hooks/use-stable-top-inset';

/** Bottom edge of fixed tab chrome (status bar + Koko Bay row + promo/incident strips). */
export function useTabChromeTop(): number {
  const topInset = useStableTopInset();
  const bannerHeight = useAppErrorBannerChromeHeight();
  return luxuryHeaderTotalHeight(topInset, bannerHeight);
}

/** Full scroll clearance under tab chrome overlays (chromeTop + editorial gap). */
export function useTabContentTopSpacerHeight(): number {
  return useTabChromeTop() + LUXURY_TAB_HEADER_CONTENT_GAP;
}

/** Total top spacer before PLP title rows — matches `LuxuryTabBodySpacer`. */
export function usePlpListHeaderTopSpacerHeight(): number {
  return useTabContentTopSpacerHeight();
}
