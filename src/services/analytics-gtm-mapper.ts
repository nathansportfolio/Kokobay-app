import type { GtmDataLayerEvent, GtmEcommerce, GtmEcommerceItem } from '@/lib/gtm/types';
import type {
  FirebaseAnalyticsEventName,
  FirebaseAnalyticsItem,
  FirebaseEcommerceEventParams,
} from '@/src/types/analytics';

function isHomePagePath(pagePath?: string): boolean {
  if (!pagePath) return false;
  const normalized = pagePath.replace(/\/+$/, '') || '/';
  return (
    normalized === '/' ||
    normalized === '/(tabs)' ||
    normalized === '/(tabs)/index' ||
    normalized.endsWith('/index')
  );
}

function collectionHandleFromPath(pagePath?: string): string | undefined {
  if (!pagePath) return undefined;
  const match = pagePath.match(/\/(?:collection|collections)\/([^/?#]+)/i);
  return match?.[1];
}

function toFirebaseItem(item: GtmEcommerceItem): FirebaseAnalyticsItem {
  return {
    item_id: item.item_id,
    item_name: item.item_name,
    item_brand: item.item_brand,
    item_category: item.item_category,
    item_variant: item.item_variant,
    price: item.price,
    quantity: item.quantity,
    index: item.index,
  };
}

function toEcommerceParams(ecommerce?: GtmEcommerce | null): FirebaseEcommerceEventParams {
  if (!ecommerce) return {};

  const items = ecommerce.items?.map(toFirebaseItem);

  return {
    currency: ecommerce.currency,
    value: ecommerce.value,
    items: items?.length ? items : undefined,
    item_list_id: ecommerce.item_list_id,
    item_list_name: ecommerce.item_list_name,
    transaction_id: ecommerce.transaction_id,
    search_term: ecommerce.search_term,
    method: ecommerce.method,
  };
}

export type FirebaseAnalyticsDispatch =
  | { type: 'custom'; name: FirebaseAnalyticsEventName; params?: Record<string, unknown> }
  | { type: 'screen_view'; screenName: string; screenClass?: string }
  | {
      type: 'recommended';
      method:
        | 'logViewItem'
        | 'logAddToCart'
        | 'logRemoveFromCart'
        | 'logViewCart'
        | 'logBeginCheckout'
        | 'logPurchase'
        | 'logSearch'
        | 'logLogin'
        | 'logSignUp'
        | 'logAddToWishlist'
        | 'logViewItemList';
      params: FirebaseEcommerceEventParams;
    };

export function mapGtmEventToFirebaseDispatches(event: GtmDataLayerEvent): FirebaseAnalyticsDispatch[] {
  const ecommerce = toEcommerceParams(event.ecommerce);
  const pagePath = typeof event.page_path === 'string' ? event.page_path : undefined;
  const pageTitle = typeof event.page_title === 'string' ? event.page_title : undefined;
  const searchTerm =
    typeof event.search_term === 'string'
      ? event.search_term
      : ecommerce.search_term;

  switch (event.event) {
    case 'page_view': {
      const dispatches: FirebaseAnalyticsDispatch[] = [];

      if (isHomePagePath(pagePath)) {
        dispatches.push({
          type: 'custom',
          name: 'view_home',
          params: { page_path: pagePath, page_title: pageTitle },
        });
      }

      const collectionHandle = collectionHandleFromPath(pagePath);
      if (collectionHandle) {
        dispatches.push({
          type: 'custom',
          name: 'view_collection',
          params: {
            item_list_id: collectionHandle,
            page_path: pagePath,
            page_title: pageTitle,
          },
        });
      }

      dispatches.push({
        type: 'screen_view',
        screenName: pageTitle ?? pagePath ?? 'unknown',
        screenClass: pagePath,
      });

      return dispatches;
    }

    case 'view_item_list':
      return [
        {
          type: 'custom',
          name: 'view_collection',
          params: {
            item_list_id: ecommerce.item_list_id,
            item_list_name: ecommerce.item_list_name,
            page_path: pagePath,
          },
        },
        { type: 'recommended', method: 'logViewItemList', params: ecommerce },
      ];

    case 'view_item':
      return [{ type: 'recommended', method: 'logViewItem', params: ecommerce }];

    case 'add_to_cart':
      return [{ type: 'recommended', method: 'logAddToCart', params: ecommerce }];

    case 'remove_from_cart':
      return [{ type: 'recommended', method: 'logRemoveFromCart', params: ecommerce }];

    case 'view_cart':
      return [{ type: 'recommended', method: 'logViewCart', params: ecommerce }];

    case 'begin_checkout':
      return [{ type: 'recommended', method: 'logBeginCheckout', params: ecommerce }];

    case 'purchase':
      return [{ type: 'recommended', method: 'logPurchase', params: ecommerce }];

    case 'search':
      return [
        {
          type: 'recommended',
          method: 'logSearch',
          params: { ...ecommerce, search_term: searchTerm },
        },
      ];

    case 'login':
      return [
        {
          type: 'recommended',
          method: 'logLogin',
          params: { method: typeof event.method === 'string' ? event.method : 'email' },
        },
      ];

    case 'sign_up':
      return [
        {
          type: 'recommended',
          method: 'logSignUp',
          params: { method: typeof event.method === 'string' ? event.method : 'email' },
        },
      ];

    case 'add_to_wishlist':
      return [{ type: 'recommended', method: 'logAddToWishlist', params: ecommerce }];

    case 'app_update_required_shown':
      return [
        {
          type: 'custom',
          name: 'app_update_required_shown',
          params: {
            app_version_current: event.app_version_current,
            app_version_latest: event.app_version_latest,
          },
        },
      ];

    case 'app_update_optional_shown':
      return [
        {
          type: 'custom',
          name: 'app_update_optional_shown',
          params: {
            app_version_current: event.app_version_current,
            app_version_latest: event.app_version_latest,
          },
        },
      ];

    case 'app_update_clicked':
      return [
        {
          type: 'custom',
          name: 'app_update_clicked',
          params: {
            update_prompt: event.update_prompt,
            app_version_current: event.app_version_current,
            app_version_latest: event.app_version_latest,
          },
        },
      ];

    case 'app_update_dismissed':
      return [
        {
          type: 'custom',
          name: 'app_update_dismissed',
          params: {
            dismiss_source: event.dismiss_source,
            app_version_current: event.app_version_current,
            app_version_latest: event.app_version_latest,
          },
        },
      ];

    case 'quick_add_to_bag_clicked':
      return [
        {
          type: 'custom',
          name: 'quick_add_to_bag_clicked',
          params: {
            item_id: event.item_id,
            item_name: event.item_name,
            product_handle: event.product_handle,
          },
        },
      ];

    case 'quick_add_to_bag_modal_shown':
      return [
        {
          type: 'custom',
          name: 'quick_add_to_bag_modal_shown',
          params: {
            item_id: event.item_id,
            item_name: event.item_name,
            product_handle: event.product_handle,
          },
        },
      ];

    case 'filter_selected':
      return [
        {
          type: 'custom',
          name: 'filter_selected',
          params: {
            filter_type: event.filter_type,
            filter_value: event.filter_value,
            selected: event.selected,
            list_id: event.list_id,
            list_name: event.list_name,
          },
        },
      ];

    default:
      return [];
  }
}
