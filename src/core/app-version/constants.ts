/** SecureStore keys — versioned for future migrations. */
export const APP_VERSION_CONFIG_CACHE_KEY = 'kokobay_app_version_config_v1';
export const APP_VERSION_OPTIONAL_DISMISS_KEY = 'kokobay_app_version_optional_dismiss_v1';

export const APP_VERSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const APP_VERSION_OPTIONAL_DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

/** App Store Connect id from eas.json submit.production.ios.ascAppId */
export const IOS_APP_STORE_ID = '6773783258';
export const ANDROID_PACKAGE_NAME = 'com.kokobay.kokobayapp';

export const APP_STORE_LINKS = {
  ios: {
    native: `itms-apps://itunes.apple.com/app/id${IOS_APP_STORE_ID}`,
    web: `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`,
  },
  android: {
    native: `market://details?id=${ANDROID_PACKAGE_NAME}`,
    web: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`,
  },
} as const;
