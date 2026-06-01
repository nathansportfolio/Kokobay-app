/**
 * Shopify incident banner — `GET /api/app-error` (optional; off by default).
 * Client error logging uses `POST /api/app/error-log` instead — see `lib/appErrorLog.ts`.
 */
export const APP_ERROR_API_PATH = '/api/app-error';

/** Fixed strip height under the header row when the banner is visible (px). */
export const APP_ERROR_BANNER_STRIP_HEIGHT = 52;
