import type { AddToCartInput } from '@/store/cart';
import type { CartLine } from '@/types/cart';
import type { Product, ProductVariant } from '@/types/shopify';

import { pushToDataLayer } from './data-layer';
import type { SelectItemSourceScreen } from './types';
import {
  gtmCartCurrency,
  gtmCartValue,
  gtmItemFromAddToCartInput,
  gtmItemFromCartLine,
  gtmItemFromProduct,
  gtmItemsFromProducts,
} from './mappers';

function withEcommerceClear<T extends Record<string, unknown>>(event: T) {
  return { ecommerce_clear: true, ...event };
}

export function trackPageView(input: { pagePath: string; pageTitle?: string }) {
  pushToDataLayer({
    event: 'page_view',
    page_path: input.pagePath,
    page_title: input.pageTitle,
    page_location: `kokobay://${input.pagePath.replace(/^\//, '')}`,
  });
}

export function trackViewItem(input: {
  product: Product;
  variant?: ProductVariant | null;
  currency?: string;
}) {
  const item = gtmItemFromProduct(input.product, {
    variant: input.variant,
    quantity: 1,
    currency: input.currency,
  });

  pushToDataLayer(
    withEcommerceClear({
      event: 'view_item',
      ecommerce: {
        currency: item.currency,
        value: item.price,
        items: [item],
      },
    }),
  );
}

export function trackSelectItem(input: {
  product: Product;
  source_screen: SelectItemSourceScreen;
  item_list_id: string;
  item_list_name: string;
  index?: number;
  search_term?: string;
  variant_id?: string;
}) {
  const item = gtmItemFromProduct(input.product, { index: input.index });
  const variantId = input.variant_id ?? item.item_id;

  pushToDataLayer(
    withEcommerceClear({
      event: 'select_item',
      item_list_id: input.item_list_id,
      item_list_name: input.item_list_name,
      item_id: item.item_id,
      item_name: item.item_name,
      product_handle: input.product.handle,
      variant_id: variantId,
      index: input.index,
      source_screen: input.source_screen,
      ...(input.search_term ? { search_term: input.search_term } : {}),
      ecommerce: {
        item_list_id: input.item_list_id,
        item_list_name: input.item_list_name,
        items: [{ ...item, index: input.index }],
      },
    }),
  );
}

export function trackViewItemList(input: {
  listId: string;
  listName: string;
  products: Product[];
  currency?: string;
}) {
  const items = gtmItemsFromProducts(input.products, {
    currency: input.currency,
    limit: 24,
  });

  pushToDataLayer(
    withEcommerceClear({
      event: 'view_item_list',
      ecommerce: {
        item_list_id: input.listId,
        item_list_name: input.listName,
        currency: input.currency,
        items,
      },
    }),
  );
}

export function trackAddToCart(input: AddToCartInput) {
  const item = gtmItemFromAddToCartInput(input);
  const value = item.price !== undefined ? item.price * (input.qty || 1) : undefined;

  pushToDataLayer(
    withEcommerceClear({
      event: 'add_to_cart',
      ecommerce: {
        currency: item.currency,
        value,
        items: [item],
      },
    }),
  );
}

export function trackRemoveFromCart(line: CartLine) {
  const item = gtmItemFromCartLine(line);
  const value = item.price !== undefined ? item.price * line.qty : undefined;

  pushToDataLayer(
    withEcommerceClear({
      event: 'remove_from_cart',
      ecommerce: {
        currency: item.currency,
        value,
        items: [item],
      },
    }),
  );
}

export function trackCartQuantityIncreased(input: {
  line: CartLine;
  quantityBefore: number;
  quantityAfter: number;
}) {
  pushToDataLayer({
    event: 'cart_quantity_increased',
    item_id: input.line.variantId,
    item_name: input.line.title?.trim() || input.line.handle,
    product_handle: input.line.handle,
    quantity_before: input.quantityBefore,
    quantity_after: input.quantityAfter,
  });
}

export function trackCartQuantityDecreased(input: {
  line: CartLine;
  quantityBefore: number;
  quantityAfter: number;
}) {
  pushToDataLayer({
    event: 'cart_quantity_decreased',
    item_id: input.line.variantId,
    item_name: input.line.title?.trim() || input.line.handle,
    product_handle: input.line.handle,
    quantity_before: input.quantityBefore,
    quantity_after: input.quantityAfter,
  });
}

export function trackViewCart(lines: CartLine[]) {
  const items = lines.map((line, index) => gtmItemFromCartLine(line, index));

  pushToDataLayer(
    withEcommerceClear({
      event: 'view_cart',
      ecommerce: {
        currency: gtmCartCurrency(lines),
        value: gtmCartValue(lines),
        items,
      },
    }),
  );
}

export function trackBeginCheckout(lines: CartLine[]) {
  const items = lines.map((line, index) => gtmItemFromCartLine(line, index));

  pushToDataLayer(
    withEcommerceClear({
      event: 'begin_checkout',
      ecommerce: {
        currency: gtmCartCurrency(lines),
        value: gtmCartValue(lines),
        items,
      },
    }),
  );
}

export function trackPurchase(input: {
  lines: CartLine[];
  transactionId?: string;
  value?: number;
  currency?: string;
}) {
  const items = input.lines.map((line, index) => gtmItemFromCartLine(line, index));

  pushToDataLayer(
    withEcommerceClear({
      event: 'purchase',
      ecommerce: {
        transaction_id: input.transactionId,
        currency: input.currency ?? gtmCartCurrency(input.lines),
        value: input.value ?? gtmCartValue(input.lines),
        items,
      },
    }),
  );
}

export function trackSearch(searchTerm: string) {
  pushToDataLayer({
    event: 'search',
    search_term: searchTerm,
    ecommerce: {
      search_term: searchTerm,
    },
  });
}

export function trackAddToWishlist(input: { handle: string; title?: string }) {
  pushToDataLayer({
    event: 'add_to_wishlist',
    item_id: input.handle,
    item_name: input.title ?? input.handle,
    ecommerce: {
      items: [
        {
          item_id: input.handle,
          item_name: input.title ?? input.handle,
        },
      ],
    },
  });
}

export function trackRemoveFromWishlist(input: { handle: string; title?: string }) {
  pushToDataLayer({
    event: 'remove_from_wishlist',
    item_id: input.handle,
    item_name: input.title ?? input.handle,
    ecommerce: {
      items: [
        {
          item_id: input.handle,
          item_name: input.title ?? input.handle,
        },
      ],
    },
  });
}

export function trackLogin(method = 'email') {
  pushToDataLayer({
    event: 'login',
    method,
  });
}

export function trackSignUp(method = 'email') {
  pushToDataLayer({
    event: 'sign_up',
    method,
  });
}

type AppUpdateAnalyticsInput = {
  currentVersion: string;
  latestVersion?: string;
};

export function trackAppUpdateRequiredShown(input: AppUpdateAnalyticsInput) {
  pushToDataLayer({
    event: 'app_update_required_shown',
    app_version_current: input.currentVersion,
    app_version_latest: input.latestVersion,
  });
}

export function trackAppUpdateOptionalShown(input: AppUpdateAnalyticsInput) {
  pushToDataLayer({
    event: 'app_update_optional_shown',
    app_version_current: input.currentVersion,
    app_version_latest: input.latestVersion,
  });
}

export function trackAppUpdateClicked(
  input: AppUpdateAnalyticsInput & { prompt: 'required' | 'optional' },
) {
  pushToDataLayer({
    event: 'app_update_clicked',
    update_prompt: input.prompt,
    app_version_current: input.currentVersion,
    app_version_latest: input.latestVersion,
  });
}

export function trackAppUpdateDismissed(
  input: AppUpdateAnalyticsInput & { source: 'later' | 'close' },
) {
  pushToDataLayer({
    event: 'app_update_dismissed',
    dismiss_source: input.source,
    app_version_current: input.currentVersion,
    app_version_latest: input.latestVersion,
  });
}

export function trackQuickAddToBagClicked(input: { product: Product }) {
  const item = gtmItemFromProduct(input.product);

  pushToDataLayer({
    event: 'quick_add_to_bag_clicked',
    item_id: item.item_id,
    item_name: item.item_name,
    product_handle: input.product.handle,
  });
}

export function trackQuickAddToBagModalShown(input: { product: Product }) {
  const item = gtmItemFromProduct(input.product);

  pushToDataLayer({
    event: 'quick_add_to_bag_modal_shown',
    item_id: item.item_id,
    item_name: item.item_name,
    product_handle: input.product.handle,
  });
}

export type PlpFilterAnalyticsType = 'size' | 'category' | 'colour';

export function trackFilterSelected(input: {
  filterType: PlpFilterAnalyticsType;
  filterValue: string;
  selected: boolean;
  listId?: string;
  listName?: string;
}) {
  pushToDataLayer({
    event: 'filter_selected',
    filter_type: input.filterType,
    filter_value: input.filterValue,
    selected: input.selected,
    ...(input.listId ? { list_id: input.listId } : {}),
    ...(input.listName ? { list_name: input.listName } : {}),
  });
}
