/** Custom URL scheme for Google Ads / deferred deep links. */
export const APP_URL_SCHEME = 'kokobay';

/** Legacy scheme from earlier builds — still accepted when parsing URLs. */
export const LEGACY_APP_URL_SCHEME = 'kokobayapp';

export const KOKOBAY_STORE_HOSTS = [
  'kokobay.co.uk',
  'www.kokobay.co.uk',
] as const;

export const IOS_BUNDLE_IDENTIFIER = 'com.kokobay.kokobayapp';
export const ANDROID_PACKAGE_NAME = 'com.kokobay.kokobayapp';

/** Universal / App Link path prefixes served by the Online Store. */
export const UNIVERSAL_LINK_PATH_PREFIXES = [
  '/products/',
  '/collections/',
  '/search',
  '/pages/',
  '/content/',
  '/account/',
  '/cart',
  '/wishlist',
] as const;
