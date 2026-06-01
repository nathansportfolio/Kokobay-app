import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FIRST_APP_ORDER_DISCOUNT_CODE } from '@/constants/first-app-order-discount';
import {
  deriveAppliedDiscounts,
  deriveAppliedDiscountsFromCart,
  deriveCartCostBreakdown,
  estimateCartCostBreakdown,
  resolveCartCostBreakdownForDisplay,
} from '@/utils/cart-cost-breakdown';

const gbp = (amount: string) => ({ amount, currencyCode: 'GBP' });

describe('cart cost breakdown', () => {
  it('derives discount rows from cart cost delta when codes are on cart', () => {
    const discounts = deriveAppliedDiscounts(
      gbp('80.00'),
      gbp('72.00'),
      null,
      [{ code: 'APP10', applicable: true }],
    );
    assert.equal(discounts.length, 1);
    assert.equal(discounts[0]?.code, 'APP10');
    assert.equal(discounts[0]?.amount.amount, '8.00');
  });

  it('includes discount rows in Shopify breakdown', () => {
    const breakdown = deriveCartCostBreakdown(
      gbp('80.00'),
      gbp('72.00'),
      null,
      [{ code: 'APP10', applicable: true }],
    );
    assert.equal(breakdown.appliedDiscounts[0]?.amount.amount, '8.00');
    assert.equal(breakdown.total.amount, '72.00');
  });

  it('uses cart cost delta rather than nominal API discount when they differ', () => {
    const discounts = deriveAppliedDiscountsFromCart({
      subtotal: gbp('90.00'),
      total: gbp('88.49'),
      totalTax: null,
      discountCodes: [{ code: FIRST_APP_ORDER_DISCOUNT_CODE, applicable: true, amount: gbp('4.5') }],
      cartDiscountAmount: gbp('4.5'),
    });
    assert.equal(discounts.length, 1);
    assert.equal(discounts[0]?.code, FIRST_APP_ORDER_DISCOUNT_CODE);
    assert.equal(discounts[0]?.amount.amount, '1.51');
  });

  it('returns no discount rows when subtotal equals total even with a code on cart', () => {
    const discounts = deriveAppliedDiscountsFromCart({
      subtotal: gbp('60.00'),
      total: gbp('60.00'),
      totalTax: null,
      discountCodes: [{ code: FIRST_APP_ORDER_DISCOUNT_CODE, applicable: true, amount: gbp('3.0') }],
      cartDiscountAmount: gbp('3.0'),
    });
    assert.equal(discounts.length, 0);
  });

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

  it('keeps checkout math consistent for remote cart totals', () => {
    const breakdown = resolveCartCostBreakdownForDisplay({
      lines: [
        {
          handle: 'test-skirt',
          variantId: '1',
          qty: 3,
          unitPrice: gbp('30.00'),
        },
      ],
      shopifySubtotal: gbp('90.00'),
      shopifyTotal: gbp('88.49'),
      shopifyTotalTax: null,
      shopifyDiscountCodes: [{ code: FIRST_APP_ORDER_DISCOUNT_CODE, applicable: true, amount: gbp('4.50') }],
      shopifyCartDiscountAmount: gbp('4.50'),
      usesShopifyCheckout: true,
      marketCurrency: 'GBP',
    });
    assert.equal(breakdown.subtotal.amount, '90.00');
    assert.equal(breakdown.total.amount, '88.49');
    assert.equal(breakdown.appliedDiscounts[0]?.amount.amount, '1.51');
    const subtotalN = Number.parseFloat(breakdown.subtotal.amount);
    const discountN = Number.parseFloat(breakdown.appliedDiscounts[0]!.amount.amount);
    const totalN = Number.parseFloat(breakdown.total.amount);
    assert.equal(subtotalN - discountN, totalN);
  });
});
