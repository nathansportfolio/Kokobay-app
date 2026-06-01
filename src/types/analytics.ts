import type { FirebaseAnalyticsTypes } from '@react-native-firebase/analytics';

/** Firebase / GA4 ecommerce events mirrored from the GTM data layer. */
export type FirebaseAnalyticsEventName =
  | 'view_home'
  | 'view_collection'
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'search'
  | 'login'
  | 'sign_up'
  | 'add_to_wishlist'
  | 'screen_view';

export type FirebaseAnalyticsItem = FirebaseAnalyticsTypes.Item;

export type FirebaseEcommerceEventParams = {
  currency?: string;
  value?: number;
  items?: FirebaseAnalyticsItem[];
  item_list_id?: string;
  item_list_name?: string;
  transaction_id?: string;
  search_term?: string;
  method?: string;
};

export type FirebaseAnalyticsConfig = {
  enabled: boolean;
  debug: boolean;
  iosGoogleServicesFile: string;
  androidGoogleServicesFile: string;
  apiKey?: string;
  projectId?: string;
  appId?: string;
  measurementId?: string;
};
