import type { AddToCartInput } from '@/store/cart';
import type { CartLine } from '@/types/cart';
import type { Money, Product, ProductVariant } from '@/types/shopify';

import type { GtmEcommerceItem } from './types';

function moneyToNumber(money: Money | undefined | null): number | undefined {
  if (!money) return undefined;
  const n = Number.parseFloat(money.amount);
  return Number.isFinite(n) ? n : undefined;
}

export function gtmItemFromProduct(
  product: Product,
  options?: {
    variant?: ProductVariant | null;
    quantity?: number;
    index?: number;
    currency?: string;
  },
): GtmEcommerceItem {
  const variant = options?.variant ?? product.variants[0] ?? null;
  const price = variant ? moneyToNumber(variant.price) : moneyToNumber(product.priceRange.minVariantPrice);
  const currency = options?.currency ?? variant?.price.currencyCode ?? product.priceRange.minVariantPrice.currencyCode;

  return {
    item_id: variant?.id ?? product.id,
    item_name: product.title,
    item_brand: product.vendor || 'Koko Bay',
    item_category: product.productType || undefined,
    item_variant: variant?.title || undefined,
    price,
    quantity: options?.quantity,
    index: options?.index,
    currency,
  };
}

export function gtmItemFromCartLine(line: CartLine, index?: number): GtmEcommerceItem {
  const price = line.unitPrice ? moneyToNumber(line.unitPrice) : undefined;
  return {
    item_id: line.variantId,
    item_name: line.title?.trim() || line.handle,
    item_variant: line.variantTitle || undefined,
    price,
    quantity: line.qty,
    index,
    currency: line.unitPrice?.currencyCode,
  };
}

export function gtmItemFromAddToCartInput(input: AddToCartInput): GtmEcommerceItem {
  return {
    item_id: input.variantId,
    item_name: input.title?.trim() || input.handle,
    item_variant: input.variantTitle || undefined,
    price: input.unitPrice ? moneyToNumber(input.unitPrice) : undefined,
    quantity: input.qty,
    currency: input.unitPrice?.currencyCode,
  };
}

export function gtmItemsFromProducts(
  products: Product[],
  options?: { currency?: string; limit?: number },
): GtmEcommerceItem[] {
  const limit = options?.limit ?? products.length;
  return products.slice(0, limit).map((product, index) =>
    gtmItemFromProduct(product, { index, currency: options?.currency }),
  );
}

export function gtmCartValue(lines: CartLine[]): number | undefined {
  let total = 0;
  let hasValue = false;

  for (const line of lines) {
    const unit = line.unitPrice ? moneyToNumber(line.unitPrice) : undefined;
    if (unit === undefined) continue;
    hasValue = true;
    total += unit * line.qty;
  }

  return hasValue ? total : undefined;
}

export function gtmCartCurrency(lines: CartLine[]): string | undefined {
  return lines.find((line) => line.unitPrice?.currencyCode)?.unitPrice?.currencyCode;
}
