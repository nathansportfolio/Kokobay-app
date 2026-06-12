import { StyleSheet, type TextStyle } from 'react-native';

export const KOKO_BAY_BRAND_TITLE = 'KOKO BAY';

/** Editorial chrome — white header / drawer */
export const luxuryChrome = {
  bg: '#FFFFFF',
  ink: '#111111',
  mist: '#6B6B6B',
  line: 'rgba(0,0,0,0.1)',
  backdrop: 'rgba(0,0,0,0.35)',
} as const;

export const kokoBayBrandTitleStyle: TextStyle = {
  fontFamily: 'InstrumentSans-SemiBold',
  fontSize: 13,
  letterSpacing: 4,
  color: luxuryChrome.ink,
};

export const LUXURY_HEADER_BODY_PX = 48;
export const LUXURY_HEADER_BORDER = StyleSheet.hairlineWidth;

export function tabHeaderRowHeight(): number {
  return LUXURY_HEADER_BODY_PX + LUXURY_HEADER_BORDER;
}

/** Top offset for content sitting below the fixed Koko Bay bar (no status bar). */
export function luxuryTabHeaderBarBottom(topInset: number): number {
  return topInset + tabHeaderRowHeight();
}

export function luxuryHeaderTotalHeight(topInset: number, bannerStripHeight = 0): number {
  return luxuryTabHeaderBarBottom(topInset) + bannerStripHeight;
}

/** Height of the header row below the status bar (tabs use SafeArea top + this spacer) */
export const luxuryHeaderRowHeight = tabHeaderRowHeight();

/**
 * Space between the bottom of the fixed `LuxuryTabHeader` row and the start of page content.
 * Used by `LuxuryTabBodySpacer` and PLP scroll padding so every tab route matches.
 */
export const LUXURY_TAB_HEADER_CONTENT_GAP = 12;

/** Extra air above floating bottom chrome (checkout card, PDP add-to-bag). */
export const LUXURY_TAB_CONTENT_EXTRA_BOTTOM = 10;

/**
 * PLP list-header spacer below fixed tab chrome (status bar + header row + banners + gap).
 * Prefer `usePlpListHeaderTopSpacerHeight()` in screens — it reads live banner height.
 */
export function luxuryTabPlpListHeaderPaddingTop(bannerStripHeight = 0): number {
  return tabHeaderRowHeight() + bannerStripHeight + LUXURY_TAB_HEADER_CONTENT_GAP;
}
