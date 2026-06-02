import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CartLine } from '@/types/cart';

import {
  cartLineStockLabel,
  reconcileLinesWithSnapshotSubtotal,
} from '@/utils/cart-line-stock';

const gbp = (amount: string) => ({ amount, currencyCode: 'GBP' });

describe('cart line stock', () => {
  it('shows stock label at maxQty', () => {
    const line: CartLine = {
      handle: 'dress',
      variantId: 'v1',
      qty: 3,
      maxQty: 3,
      unitPrice: gbp('25.00'),
    };
    assert.equal(cartLineStockLabel(line), 'Only 3 in stock');
  });

  it('clamps qty when server subtotal implies fewer units', () => {
    const lines: CartLine[] = [
      {
        handle: 'dress',
        variantId: 'v1',
        qty: 8,
        unitPrice: gbp('25.38'),
      },
    ];
    const snapshot = {
      cartId: 'c1',
      checkoutUrl: 'https://checkout',
      lines: [{ handle: 'dress', variantId: 'v1', qty: 8 }],
      subtotal: gbp('78.00'),
      total: gbp('78.00'),
      discountCodes: [],
    };
    const { lines: next, qtyReduced } = reconcileLinesWithSnapshotSubtotal(lines, snapshot);
    assert.equal(qtyReduced?.actual, 3);
    assert.equal(qtyReduced?.requested, 8);
    assert.equal(next[0]?.qty, 3);
    assert.equal(next[0]?.maxQty, 3);
  });

  it('skips subtotal clamp when discount codes are on cart', () => {
    const lines: CartLine[] = [
      { handle: 'dress', variantId: 'v1', qty: 8, unitPrice: gbp('25.00') },
    ];
    const snapshot = {
      cartId: 'c1',
      checkoutUrl: 'https://checkout',
      lines: [{ handle: 'dress', variantId: 'v1', qty: 8 }],
      subtotal: gbp('78.00'),
      total: gbp('70.00'),
      discountCodes: [{ code: 'APP10', applicable: true }],
    };
    const { lines: next, qtyReduced } = reconcileLinesWithSnapshotSubtotal(lines, snapshot);
    assert.equal(qtyReduced, null);
    assert.equal(next[0]?.qty, 8);
  });
});
