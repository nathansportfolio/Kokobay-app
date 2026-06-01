/** Home hero content slug — same route as returns-info (`GET /api/content/[slug]`). */
export const APP_HOME_HERO_CONTENT_SLUG = 'app-home-hero';

/** React Query key aligned with `useAppContent` (`app-content` + slug + country). */
export const APP_HOME_HERO_QUERY_KEY = ['app-content', APP_HOME_HERO_CONTENT_SLUG] as const;

/** Built-in fallback when CMS has no row for the selected country (and no GLOBAL). */
export const DEFAULT_HOME_HERO_KICKER = 'NEW IN';
export const DEFAULT_HOME_HERO_CTA_LABEL = 'SHOP NOW';
export const DEFAULT_HOME_HERO_TEXT_COLOR = '#FFFFFF';
export const DEFAULT_HOME_HERO_BUTTON_BG = '#FFFFFF';
export const DEFAULT_HOME_HERO_BUTTON_TEXT_COLOR = '#111111';
