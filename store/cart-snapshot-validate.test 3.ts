import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ShopifyCartSnapshot } from '@/services/shopify/cart';

import {
  compareSnapshotVersions,
  extractSnapshotVersion,
  validateCartSnapshot,
} from './cart-snapshot-validate';
import { detectCartDivergence } from './cart-snapshot-gateway';

function baseSnapshot(overrides: Partial<ShopifyCartSnapshot> = {}): ShopifyCartSnapshot {
  return {
    cartId: 'cart-1',
    checkoutUrl: 'https://checkout.test/c/1',
    lines: [
      {
        handle: 'dress',
        variantId: 'gid://shopify/ProductVariant/1001',
        qty: 1,
        unitPrice: { amount: '89.00', currencyCode: 'GBP' },
      },
    ],
    subtotal: { amount: '89.00', currencyCode: 'GBP' },
    total: { amount: '89.00', currencyCode: 'GBP' },
    ...overrides,
  };
}

describe('validateCartSnapshot', () => {
  it('accepts a healthy snapshot', () => {
    assert.equal(validateCartSnapshot(baseSnapshot()).ok, true);
  });

  it('rejects empty lines with non-zero subtotal', () => {
    const result = validateCartSnapshot(
      baseSnapshot({
        lines: [],
        subtotal: { amount: '10.00', currencyCode: 'GBP' },
        total: { amount: '0.00', currencyCode: 'GBP' },
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'empty_lines_nonzero_subtotal');
  });

  it('rejects duplicate variant ids', () => {
    const line = baseSnapshot().lines[0]!;
    const result = validateCartSnapshot(
      baseSnapshot({
        lines: [line, { ...line }],
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'duplicate_variant_id');
  });
});

describe('extractSnapshotVersion', () => {
  it('returns null when no version field exists on Shopify snapshots', () => {
    assert.equal(extractSnapshotVersion(baseSnapshot()), null);
  });

  it('reads version fields when present on extended payloads', () => {
    const snapshot = {
      ...baseSnapshot(),
      updatedAt: '2026-06-08T10:00:00.000Z',
    } as ShopifyCartSnapshot;
    assert.equal(extractSnapshotVersion(snapshot), '2026-06-08T10:00:00.000Z');
  });
});

describe('compareSnapshotVersions', () => {
  it('orders ISO timestamps', () => {
    assert.equal(
      compareSnapshotVersions('2026-06-08T11:00:00.000Z', '2026-06-08T10:00:00.000Z'),
      'newer',
    );
    assert.equal(
      compareSnapshotVersions('2026-06-08T09:00:00.000Z', '2026-06-08T10:00:00.000Z'),
      'older',
    );
  });
});

describe('detectCartDivergence', () => {
  it('detects line count mismatch', () => {
    const snapshot = baseSnapshot();
    assert.equal(detectCartDivergence([], snapshot, null), true);
  });
});
