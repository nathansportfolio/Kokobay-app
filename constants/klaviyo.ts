/**
 * Klaviyo public Site ID (6-char key from Klaviyo → Settings → API keys).
 * Client-safe — embedded so production builds work without EAS env for Klaviyo.
 * Override with `EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY` or disable with `EXPO_PUBLIC_KLAVIYO_ENABLED=false`.
 */
export const KLAVIYO_PUBLIC_SITE_ID = 'THMpay';

/** Default on; set `EXPO_PUBLIC_KLAVIYO_ENABLED=false` to disable SDK + native plugin. */
export const KLAVIYO_ENABLED_DEFAULT = true;
