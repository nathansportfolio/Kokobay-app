import type { EventProperties } from 'klaviyo-react-native-sdk';

import type { GtmDataLayerEvent, GtmEcommerce, GtmEcommerceItem } from '@/lib/gtm/types';
import { trackKlaviyoEvent } from '@/lib/klaviyo/client';

/** Klaviyo metric names used in dashboards and flows. */
export const KlaviyoMetric = {
  productViewed: 'Product Viewed',
  collectionViewed: 'Collection Viewed',
  addedToCart: 'Added To Cart',
  checkoutStarted: 'Checkout Started',
  orderPlaced: 'Order Placed',
  wishlistAdded: 'Wishlist Added',
} as const;

function itemProperties(item: GtmEcommerceItem): Record<string, string | number> {
  const props: Record<string, string | number> = {
    ProductID: item.item_id,
    ProductName: item.item_name,
  };
  if (item.item_variant) props.ProductVariant = item.item_variant;
  if (item.item_brand) props.Brand = item.item_brand;
  if (item.item_category) props.Categories = item.item_category;
  if (item.price != null) props.Price = item.price;
  if (item.quantity != null) props.Quantity = item.quantity;
  if (item.currency) props.Currency = item.currency;
  return props;
}

function ecommerceProperties(ecommerce?: GtmEcommerce | null): EventProperties {
  if (!ecommerce) return {};
  const props: EventProperties = {};
  if (ecommerce.currency) props.Currency = ecommerce.currency;
  if (ecommerce.value != null) props.$value = ecommerce.value as number;
  if (ecommerce.item_list_id) props.CollectionID = ecommerce.item_list_id;
  if (ecommerce.item_list_name) props.CollectionName = ecommerce.item_list_name;
  if (ecommerce.transaction_id) props.OrderID = ecommerce.transaction_id;
  const items = ecommerce.items ?? [];
  if (items.length === 1) {
    Object.assign(props, itemProperties(items[0]!));
  } else if (items.length > 1) {
    props.Items = items.map((row) => itemProperties(row)) as unknown as EventProperties[string];
    props.ProductNames = items.map((row) => row.item_name).join(', ');
    props.ProductIDs = items.map((row) => row.item_id).join(', ');
  }
  return props;
}

function sendMetric(name: string, ecommerce?: GtmEcommerce | null, uniqueId?: string): void {
  const properties = ecommerceProperties(ecommerce);
  trackKlaviyoEvent({
    name,
    value: ecommerce?.value,
    uniqueId,
    ...(Object.keys(properties).length > 0 ? { properties } : {}),
  });
}

/**
 * Mirror GTM ecommerce events into Klaviyo. Called from `pushToDataLayer` alongside Firebase.
 * Does not touch Expo push registration or Koko Bay `/api/push/*`.
 */
export function trackDataLayerEventForKlaviyo(event: GtmDataLayerEvent): void {
  const ecommerce = event.ecommerce ?? undefined;

  switch (event.event) {
    case 'view_item':
      sendMetric(KlaviyoMetric.productViewed, ecommerce);
      return;
    case 'view_item_list':
      sendMetric(KlaviyoMetric.collectionViewed, ecommerce);
      return;
    case 'add_to_cart':
      sendMetric(KlaviyoMetric.addedToCart, ecommerce);
      return;
    case 'begin_checkout':
      sendMetric(KlaviyoMetric.checkoutStarted, ecommerce);
      return;
    case 'purchase':
      sendMetric(
        KlaviyoMetric.orderPlaced,
        ecommerce,
        typeof ecommerce?.transaction_id === 'string' ? ecommerce.transaction_id : undefined,
      );
      return;
    case 'add_to_wishlist':
      sendMetric(KlaviyoMetric.wishlistAdded, ecommerce);
      return;
    default:
      return;
  }
}
