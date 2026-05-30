/** GA4-style ecommerce item — maps cleanly into GTM dataLayer. */
export type GtmEcommerceItem = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
  index?: number;
  currency?: string;
};

export type GtmEcommerce = {
  currency?: string;
  value?: number;
  items?: GtmEcommerceItem[];
  item_list_id?: string;
  item_list_name?: string;
  transaction_id?: string;
  search_term?: string;
  method?: string;
};

export type GtmEventName =
  | 'page_view'
  | 'view_item'
  | 'view_item_list'
  | 'select_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'search'
  | 'add_to_wishlist'
  | 'remove_from_wishlist'
  | 'login'
  | 'sign_up';

export type GtmDataLayerEvent = {
  event: GtmEventName;
  page_path?: string;
  page_title?: string;
  page_location?: string;
  ecommerce?: GtmEcommerce | null;
  /** Clears prior ecommerce object on the next push (GTM convention). */
  ecommerce_clear?: boolean;
  [key: string]: unknown;
};

export type GtmReceiver = {
  readonly name: string;
  push: (event: GtmDataLayerEvent) => void;
};
