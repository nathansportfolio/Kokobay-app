import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deriveCartCostBreakdown, estimateCartCostBreakdown, resolveCartCostBreakdownForDisplay } from '@/utils/cart-cost-breakdown';

const gbp = (amount: string) => ({ amount, currencyCode: 'GBP' });

describe('cart cost breakdown', () => {
  it('derives delivery from total minus subtotal', () => {
    const breakdown = deriveCartCostBreakdown(gbp('16.00'), gbp('19.99'));
    assert.equal(breakdown.delivery?.amount, '3.99');
    assert.equal(breakdown.total.amount, '19.99');
  });

  it('separates tax when provided', () => {
    const breakdown = deriveCartCostBreakdown(gbp('16.00'), gbp('22.99'), gbp('3.00'));
    assert.equal(breakdown.tax?.amount, '3.00');
    assert.equal(breakdown.delivery?.amount, '3.99');
  });

  it('estimates local delivery for offline bag', () => {
    const breakdown = estimateCartCostBreakdown(gbp('16.00'));
    assert.equal(breakdown.delivery?.amount, '3.99');
    assert.equal(breakdown.total.amount, '19.99');
  });

  it('falls back to line subtotal when Shopify currency mismatches market', () => {
    const breakdown = resolveCartCostBreakdownForDisplay({
      lines: [
        {
          handle: 'test-skirt',
          variantId: '1',
          qty: 1,
          unitPrice: gbp('45.00'),
        },
        {
          handle: 'test-mini',
          variantId: '2',
          qty: 1,
          unitPrice: gbp('35.00'),
        },
      ],
      shopifySubtotal: { amount: '121.00', currencyCode: 'USD' },
      shopifyTotal: { amount: '121.00', currencyCode: 'USD' },
      shopifyTotalTax: null,
      usesShopifyCheckout: true,
      marketCurrency: 'GBP',
    });
    assert.equal(breakdown.subtotal.amount, '80.00');
    assert.equal(breakdown.subtotal.currencyCode, 'GBP');
  });
});
