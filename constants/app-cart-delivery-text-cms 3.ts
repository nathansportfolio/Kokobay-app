/** Cart delivery row label when checkout calculates shipping — `GET /api/content/app-cart-delivery-text-{country}`. */
export const APP_CART_DELIVERY_TEXT_CONTENT_SLUG = 'app-cart-delivery-text';

export const APP_CART_DELIVERY_TEXT_QUERY_KEY = [
  'app-content',
  APP_CART_DELIVERY_TEXT_CONTENT_SLUG,
] as const;

/** Built-in fallback when CMS has no row for the selected country. */
export const DEFAULT_CART_DELIVERY_AT_CHECKOUT_LABEL = 'Calculated on checkout';
