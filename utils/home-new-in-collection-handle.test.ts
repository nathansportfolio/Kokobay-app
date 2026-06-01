import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveHomeNewInCollectionHandle } from '@/utils/home-new-in-collection-handle';

describe('resolveHomeNewInCollectionHandle', () => {
  it('uses collection handle from CMS hero button link', () => {
    assert.equal(
      resolveHomeNewInCollectionHandle('https://www.kokobay.co.uk/collections/all-new-in'),
      'all-new-in',
    );
  });

  it('falls back to default when link is missing', () => {
    assert.equal(resolveHomeNewInCollectionHandle(undefined), 'all-new-in');
  });
});
