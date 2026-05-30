import { palette } from '@/constants/theme';

/**
 * PLP infinite-scroll tuning + investigation flags.
 * Remove or simplify once bottom-of-list behaviour is stable.
 */

/** Product grid flush to screen edges; chrome (header/toolbar) keeps its own inset. */
export const PLP_HORIZONTAL_PAD = 0;

/** Gap between two-up product columns. */
export const PLP_COLUMN_GAP = 4;

/** White PLP shell — matches header/toolbar so side gutters are not canvas grey. */
export const plpScreenShell = { flex: 1, backgroundColor: palette.surface } as const;

/** Investigation: `maintainVisibleContentPosition` may correct scroll on bottom append. */
export const PLP_MAINTAIN_VISIBLE_CONTENT_POSITION = false;

/** Reserved footer height — spinner mounts inside fixed slot (no layout jump). */
export const PLP_INFINITE_FOOTER_HEIGHT = 52;

/** Below last grid row; add tab bar height in screen (bar already includes home-indicator inset). */
export const PLP_LIST_BOTTOM_PAD = 24;
