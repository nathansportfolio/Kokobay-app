import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CartLine } from '@/types/cart';

import { reconcileCartLinesServerAuthoritative } from './cart-line-utils';

function line(variantId: string, handle: string, qty: number): CartLine {
  return {
    handle,
    variantId,
    qty,
    title: handle,
    unitPrice: { amount: '89.00', currencyCode: 'GBP' },
  };
}

describe('reconcileCartLinesServerAuthoritative', () => {
  it('drops local-only ghost lines and keeps remote lines', () => {
    const local = [
      line('gid://shopify/ProductVariant/1001', 'dress-a', 2),
      line('gid://shopify/ProductVariant/9999', 'ghost-item', 1),
    ];
    const remote = [line('gid://shopify/ProductVariant/1001', 'dress-a', 2)];

    const reconciled = reconcileCartLinesServerAuthoritative(local, remote);

    assert.equal(reconciled.length, 1);
    assert.equal(reconciled[0]?.variantId, remote[0]!.variantId);
    assert.equal(reconciled[0]?.qty, 2);
  });

  it('adds remote-only lines missing locally', () => {
    const local = [line('gid://shopify/ProductVariant/1001', 'dress-a', 1)];
    const remote = [
      line('gid://shopify/ProductVariant/1001', 'dress-a', 1),
      line('gid://shopify/ProductVariant/1002', 'scarf-b', 1),
    ];

    const reconciled = reconcileCartLinesServerAuthoritative(local, remote);

    assert.equal(reconciled.length, 2);
    assert.equal(reconciled[1]?.handle, 'scarf-b');
  });
});
