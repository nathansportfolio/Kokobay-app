import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clampCartQuantity,
  inventoryLimitToast,
  resolveQuantityCap,
  resolveVariantQuantityCap,
} from './cart-inventory';

describe('cart inventory helpers', () => {
  it('resolveQuantityCap ignores unknown or zero stock', () => {
    assert.equal(resolveQuantityCap(undefined), undefined);
    assert.equal(resolveQuantityCap(null), undefined);
    assert.equal(resolveQuantityCap(0), undefined);
  });

  it('resolveQuantityCap clamps to cart max', () => {
    assert.equal(resolveQuantityCap(120), 99);
    assert.equal(resolveQuantityCap(3), 3);
  });

  it('resolveVariantQuantityCap reads quantityAvailable', () => {
    assert.equal(resolveVariantQuantityCap({ quantityAvailable: 2 }), 2);
    assert.equal(resolveVariantQuantityCap({ quantityAvailable: null }), undefined);
  });

  it('clampCartQuantity caps optimistic qty', () => {
    assert.deepEqual(clampCartQuantity(8, 3), { qty: 3, capped: true });
    assert.deepEqual(clampCartQuantity(2, 5), { qty: 2, capped: false });
  });

  it('inventoryLimitToast formats copy', () => {
    assert.deepEqual(inventoryLimitToast(1), {
      variant: 'warning',
      title: 'Only 1 in stock',
      description: 'That\u2019s all we have available',
    });
    assert.deepEqual(inventoryLimitToast(4), {
      variant: 'warning',
      title: 'Only 4 in stock',
      description: 'That\u2019s all we have available',
    });
    assert.deepEqual(inventoryLimitToast(3, { requested: 5, kind: 'add' }), {
      variant: 'warning',
      title: 'Only 3 added to your bag',
      description: 'Only 3 in stock — you requested 5',
    });
    assert.deepEqual(inventoryLimitToast(2, { requested: 4, kind: 'set' }), {
      variant: 'warning',
      title: 'Only 2 in your bag',
      description: 'Only 2 in stock — you requested 4',
    });
    assert.deepEqual(inventoryLimitToast(7, { requested: 8, kind: 'set' }), {
      variant: 'warning',
      title: 'Only 7 in your bag',
      description: 'Only 7 in stock — you requested 8',
    });
    assert.deepEqual(inventoryLimitToast(1, { requested: 3, kind: 'add' }), {
      variant: 'warning',
      title: 'Only 1 added to your bag',
      description: 'Only 1 in stock — you requested 3',
    });
  });
});
