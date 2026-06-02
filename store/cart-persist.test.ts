import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cartLineMissingPersistedDisplay,
  persistedCartLineToCartLine,
  toPersistedCartLine,
  type PersistedCartLine,
} from '@/store/cart-persist';
import type { CartLine } from '@/types/cart';

describe('cart persist display snapshot', () => {
  const fullLine: CartLine = {
    handle: 'linen-midi-dress',
    variantId: 'gid://shopify/ProductVariant/1234567890',
    qty: 2,
    shopifyLineId: 'gid://shopify/CartLine/9876543210',
    title: 'Linen Midi Dress',
    variantTitle: 'Size M',
    imageUrl: 'https://cdn.shopify.com/s/files/1/example/files/dress.jpg',
    unitPrice: { amount: '89.00', currencyCode: 'GBP' },
    listUnitPrice: { amount: '89.00', currencyCode: 'GBP' },
    maxQty: 3,
  };

  it('persists display metadata for cold-start rendering', () => {
    const persisted = toPersistedCartLine(fullLine);
    assert.deepEqual(persisted, {
      handle: fullLine.handle,
      variantId: fullLine.variantId,
      qty: fullLine.qty,
      shopifyLineId: fullLine.shopifyLineId,
      title: fullLine.title,
      variantTitle: fullLine.variantTitle,
      imageUrl: fullLine.imageUrl,
      unitPrice: fullLine.unitPrice,
      listUnitPrice: fullLine.listUnitPrice,
      maxQty: fullLine.maxQty,
    });
  });

  it('omits shopifyLineId when absent', () => {
    const persisted = toPersistedCartLine({
      handle: 'tee',
      variantId: 'gid://shopify/ProductVariant/1',
      qty: 1,
    });
    assert.deepEqual(persisted, {
      handle: 'tee',
      variantId: 'gid://shopify/ProductVariant/1',
      qty: 1,
    });
  });

  it('round-trips display fields', () => {
    assert.deepEqual(persistedCartLineToCartLine(toPersistedCartLine(fullLine)), {
      handle: fullLine.handle,
      variantId: fullLine.variantId,
      qty: fullLine.qty,
      shopifyLineId: fullLine.shopifyLineId,
      title: fullLine.title,
      variantTitle: fullLine.variantTitle,
      imageUrl: fullLine.imageUrl,
      unitPrice: fullLine.unitPrice,
      listUnitPrice: fullLine.listUnitPrice,
      maxQty: fullLine.maxQty,
    });
  });

  it('round-trips minimal cart lines', () => {
    const persisted: PersistedCartLine = {
      handle: 'tee',
      variantId: 'gid://shopify/ProductVariant/1',
      qty: 1,
    };
    assert.deepEqual(persistedCartLineToCartLine(persisted), {
      handle: 'tee',
      variantId: 'gid://shopify/ProductVariant/1',
      qty: 1,
    });
  });

  it('detects lines missing persisted display metadata', () => {
    assert.equal(
      cartLineMissingPersistedDisplay({
        handle: 'tee',
        variantId: 'gid://shopify/ProductVariant/1',
        qty: 1,
        shopifyLineId: 'gid://shopify/CartLine/1',
      }),
      true,
    );
    assert.equal(cartLineMissingPersistedDisplay(fullLine), false);
  });

  it('keeps identity-only 20-line payload under SecureStore limit', () => {
    const lines = Array.from({ length: 20 }, (_, i) =>
      toPersistedCartLine({
        handle: `product-${i}`,
        variantId: `gid://shopify/ProductVariant/${1000 + i}`,
        qty: 1,
        shopifyLineId: `gid://shopify/CartLine/${2000 + i}`,
      }),
    );
    const bytes = JSON.stringify(lines).length;
    assert.ok(bytes < 2048, `expected <2048 bytes, got ${bytes}`);
  });
});
