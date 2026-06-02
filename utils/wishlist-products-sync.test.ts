import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { QueryClient } from '@tanstack/react-query';

import { pruneWishlistProductsMap, syncWishlistProductsMap } from '@/utils/wishlist-products-sync';
import { wishlistProductsQueryKey } from '@/utils/wishlist-query-key';

describe('wishlist products sync', () => {
  it('pruneWishlistProductsMap drops handles not in the list', () => {
    const previous = {
      a: { handle: 'a' } as never,
      b: { handle: 'b' } as never,
      c: { handle: 'c' } as never,
    };
    const pruned = pruneWishlistProductsMap(previous, ['a', 'c']);
    assert.deepEqual(Object.keys(pruned ?? {}), ['a', 'c']);
  });

  it('syncWishlistProductsMap returns pruned cache without network when only removing', async () => {
    const queryClient = new QueryClient();
    const cacheKey = wishlistProductsQueryKey('GB');
    queryClient.setQueryData(cacheKey, {
      a: { handle: 'a' } as never,
      b: { handle: 'b' } as never,
    });

    const result = await syncWishlistProductsMap(queryClient, cacheKey, ['a'], 'GBP');
    assert.equal(result.a?.handle, 'a');
    assert.equal(result.b, undefined);
  });
});
