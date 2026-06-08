import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { estimateColourGroupUnionCount } from '@/utils/colour-groups';

describe('estimateColourGroupUnionCount', () => {
  it('returns the single label count unchanged', () => {
    assert.equal(estimateColourGroupUnionCount([12]), 12);
  });

  it('dedupes multi-label groups where Shopify facet counts overlap', () => {
    // Printed-style: Floral + Leopard + Print + Rio summed to 20, OR filter returns 18.
    assert.equal(estimateColourGroupUnionCount([8, 6, 4, 2]), 18);
  });

  it('does not shrink two-label groups aggressively', () => {
    assert.equal(estimateColourGroupUnionCount([10, 6]), 15);
  });
});
