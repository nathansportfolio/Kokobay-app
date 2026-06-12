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
  | 'checkout_button_pressed'
  | 'purchase'
  | 'search'
  | 'login'
  | 'sign_up'
  | 'add_to_wishlist'
  | 'remove_from_wishlist'
  | 'select_item'
  | 'cart_quantity_increased'
  | 'cart_quantity_decreased'
  | 'screen_view'
  | 'app_update_required_shown'
  | 'app_update_optional_shown'
  | 'app_update_clicked'
  | 'app_update_dismissed'
  | 'quick_add_to_bag_clicked'
  | 'quick_add_to_bag_modal_shown'
  | 'filter_selected';

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
