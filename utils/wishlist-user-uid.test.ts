import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  mergeWishlistEntries,
  wishlistEntriesFromRemoteItems,
  wishlistHandlesMissingOnRemote,
} from '@/utils/wishlist-entries-merge';
import {
  isValidWishlistUserUid,
  wishlistUserUidFromCustomerId,
} from '@/utils/wishlist-user-uid-core';

describe('wishlistUserUidFromCustomerId', () => {
  it('accepts opaque ids that already match the server pattern', () => {
    const uid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    assert.equal(wishlistUserUidFromCustomerId(uid), uid);
    assert.equal(isValidWishlistUserUid(uid), true);
  });

  it('maps Shopify customer gid to shopify-cust prefix', () => {
    assert.equal(
      wishlistUserUidFromCustomerId('gid://shopify/Customer/1234567890'),
      'shopify-cust-1234567890',
    );
  });

  it('rejects ids that are too short after normalization', () => {
    assert.equal(wishlistUserUidFromCustomerId('short'), null);
  });
});

describe('mergeWishlistEntries', () => {
  it('merges local and remote with newest addedAt winning', () => {
    const merged = mergeWishlistEntries(
      [{ handle: 'dress-a', addedAt: '2026-01-01T00:00:00.000Z' }],
      [{ handle: 'dress-a', addedAt: '2026-02-01T00:00:00.000Z' }],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.addedAt, '2026-02-01T00:00:00.000Z');
  });

  it('keeps local-only handles when absent on remote', () => {
    const merged = mergeWishlistEntries(
      [{ handle: 'local-only', addedAt: '2026-01-01T00:00:00.000Z' }],
      [{ handle: 'remote-only', addedAt: '2026-01-02T00:00:00.000Z' }],
    );
    assert.deepEqual(
      merged.map((entry) => entry.handle).sort(),
      ['local-only', 'remote-only'],
    );
  });

  it('maps remote API items to entries', () => {
    const entries = wishlistEntriesFromRemoteItems([
      { productHandle: 'Satin-Dress', addedAt: '2026-03-01T00:00:00.000Z' },
    ]);
    assert.deepEqual(entries, [
      { handle: 'satin-dress', addedAt: '2026-03-01T00:00:00.000Z' },
    ]);
  });

  it('lists handles missing on remote after merge', () => {
    const remote = [{ handle: 'shared', addedAt: '2026-01-01T00:00:00.000Z' }];
    const merged = mergeWishlistEntries(
      [
        { handle: 'shared', addedAt: '2026-01-01T00:00:00.000Z' },
        { handle: 'local-only', addedAt: '2026-01-02T00:00:00.000Z' },
      ],
      remote,
    );
    assert.deepEqual(wishlistHandlesMissingOnRemote(merged, remote), ['local-only']);
  });
});
