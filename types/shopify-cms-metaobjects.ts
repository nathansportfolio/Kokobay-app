/**
 * Shopify CMS metaobjects consumed by the Koko Bay mobile app via the kokobay web API.
 *
 * Storefront GraphQL (web server) loads entries with:
 *   metaobjects(type: "<type>", first: N) { nodes { handle fields { key type value } } }
 *
 * The app calls kokobay HTTP routes — not Shopify directly. Entries must be Active
 * and the definition must allow Storefront API access in Shopify Admin.
 */

import type { AppContent } from '@/types/app-content';
import type { AppHomeHeroPayload } from '@/services/kokobay-web/app-home-hero';
import type { AppErrorBannerPayload } from '@/services/kokobay-web/app-error';
import type { AppPromotionBannerPayload } from '@/services/kokobay-web/app-promotion-banner';
import type { CmsCollectionTile } from '@/services/kokobay-web/collections-cms';

export const APP_HOME_HERO_METAOBJECT_TYPE = 'app_home_hero' as const;
export const APP_CONTENT_METAOBJECT_TYPE = 'app_content' as const;
export const APP_ERROR_METAOBJECT_TYPE = 'app_error' as const;
export const APP_PROMOTION_BANNER_METAOBJECT_TYPE = 'app_promotion_banner' as const;
export const DELIVERY_THRESHOLD_METAOBJECT_TYPE = 'delivery_threshold' as const;
export const COLLECTIONS_CMS_METAOBJECT_TYPE = 'collections' as const;

export type {
  AppContent,
  AppHomeHeroPayload,
  AppErrorBannerPayload,
  AppPromotionBannerPayload,
  CmsCollectionTile,
};

/** Shopify field type strings as returned by Storefront `fields.type`. */
export type ShopifyMetaobjectFieldType =
  | 'boolean'
  | 'single_line_text_field'
  | 'rich_text_field'
  | 'number_integer'
  | 'file_reference';

/** Raw field row from Storefront `metaobjects.nodes[].fields[]`. */
export type ShopifyMetaobjectField = {
  key: string;
  type: ShopifyMetaobjectFieldType | string;
  value: string | null;
};

/** Raw metaobject node from Storefront before app-specific mapping. */
export type ShopifyMetaobjectNode = {
  handle: string;
  type: string;
  fields: ShopifyMetaobjectField[];
};

/** Field keys on a Shopify metaobject definition (verified via Storefront / Admin). */
export type ShopifyCmsFieldDef = {
  key: string;
  type: ShopifyMetaobjectFieldType | string;
  /** Human label in Shopify Admin when it differs from `key`. */
  label?: string;
};

/** One CMS metaobject definition and how the mobile app reads it. */
export type ShopifyCmsMetaobjectDef = {
  /** GraphQL `metaobjects(type: …)` value. */
  type: string;
  /** Label in Shopify Admin → Content → Metaobjects. */
  adminName: string;
  /** Kokobay web API route(s) the app calls. */
  apiRoutes: readonly string[];
  fields: readonly ShopifyCmsFieldDef[];
  /** Example entry handles seen in production Storefront (may be empty if not published). */
  exampleHandles: readonly string[];
};

/** All mobile CMS metaobject definitions — order matches Shopify Admin list. */
export const SHOPIFY_CMS_METAOBJECT_DEFS = {
  appHomeHero: {
    type: APP_HOME_HERO_METAOBJECT_TYPE,
    adminName: 'App Home Hero',
    apiRoutes: ['GET /api/content/app-home-hero?country={GB|US|EU}'],
    fields: [
      { key: 'image', type: 'file_reference', label: 'Image' },
      { key: 'text', type: 'single_line_text_field', label: 'Text' },
      { key: 'button text', type: 'single_line_text_field', label: 'Button text' },
      { key: 'button link', type: 'single_line_text_field', label: 'Button link' },
      { key: 'text colour', type: 'single_line_text_field', label: 'Text colour' },
      { key: 'button background', type: 'single_line_text_field', label: 'Button background' },
      { key: 'button text colour', type: 'single_line_text_field', label: 'Button text colour' },
      { key: 'country', type: 'single_line_text_field', label: 'Country' },
    ],
    exampleHandles: ['gb', 'us', 'eu'],
  },
  appContent: {
    type: APP_CONTENT_METAOBJECT_TYPE,
    adminName: 'App Content',
    apiRoutes: ['GET /api/content/{slug}?country={GB|US|EU}'],
    fields: [
      { key: 'active', type: 'boolean' },
      { key: 'content', type: 'rich_text_field' },
      { key: 'country', type: 'single_line_text_field' },
      { key: 'slug', type: 'single_line_text_field' },
      { key: 'title', type: 'single_line_text_field' },
    ],
    exampleHandles: ['returns-info-gb', 'return-info-us', 'returns-info-eu'],
  },
  appError: {
    type: APP_ERROR_METAOBJECT_TYPE,
    adminName: 'App Error',
    apiRoutes: ['GET /api/app-error'],
    fields: [
      { key: 'active', type: 'boolean' },
      { key: 'error_message', type: 'single_line_text_field' },
    ],
    exampleHandles: ['we-are-currently-experiencing-issues-please-try-again-later'],
  },
  appPromotionBanner: {
    type: APP_PROMOTION_BANNER_METAOBJECT_TYPE,
    adminName: 'App Promotion Banner',
    apiRoutes: ['GET /api/app-promotion-banner'],
    fields: [
      { key: 'active', type: 'boolean' },
      { key: 'content', type: 'single_line_text_field' },
    ],
    exampleHandles: ['100-off-everything'],
  },
  deliveryThreshold: {
    type: DELIVERY_THRESHOLD_METAOBJECT_TYPE,
    adminName: 'Delivery Threshold',
    apiRoutes: ['GET /api/delivery-threshold'],
    fields: [
      {
        key: 'min_delivery_value_100_100',
        type: 'number_integer',
        label: 'Minimum order value (GBP) for free delivery',
      },
    ],
    exampleHandles: ['100'],
  },
  collections: {
    type: COLLECTIONS_CMS_METAOBJECT_TYPE,
    adminName: 'Collections',
    apiRoutes: ['GET /api/collections-cms'],
    fields: [
      { key: 'image', type: 'file_reference' },
      { key: 'slug', type: 'single_line_text_field' },
      { key: 'title', type: 'single_line_text_field' },
      { key: 'url', type: 'single_line_text_field' },
    ],
    exampleHandles: ['new-in', 'best-sellers', 'back-this-month', 'view-all', 'holiday-shop'],
  },
} as const satisfies Record<string, ShopifyCmsMetaobjectDef>;

export type ShopifyCmsMetaobjectKey = keyof typeof SHOPIFY_CMS_METAOBJECT_DEFS;

/** All GraphQL type strings — use in Storefront audit curls and fetch loops. */
export const SHOPIFY_CMS_METAOBJECT_TYPES = Object.values(SHOPIFY_CMS_METAOBJECT_DEFS).map(
  (def) => def.type,
);

/** Lookup definition by GraphQL type string (e.g. `"app_content"`). */
export function shopifyCmsMetaobjectDefByType(
  type: string,
): ShopifyCmsMetaobjectDef | undefined {
  const normalized = type.trim();
  return Object.values(SHOPIFY_CMS_METAOBJECT_DEFS).find((def) => def.type === normalized);
}

/** Parsed payload type per metaobject key (after kokobay API fetch). */
export type ShopifyCmsApiPayload = {
  appHomeHero: AppHomeHeroPayload;
  appContent: AppContent;
  appError: AppErrorBannerPayload;
  appPromotionBanner: AppPromotionBannerPayload;
  deliveryThreshold: number;
  collections: CmsCollectionTile;
};

/** Successful JSON response shape per metaobject key. */
export type ShopifyCmsApiResponse = {
  appHomeHero: AppHomeHeroPayload;
  appContent: AppContent;
  appError: AppErrorBannerPayload;
  appPromotionBanner: AppPromotionBannerPayload;
  deliveryThreshold: { thresholdGbp: number };
  collections: CmsCollectionTile[];
};
