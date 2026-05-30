import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractCollectionHandleFromCmsUrl } from './collection-cms-url';

describe('extractCollectionHandleFromCmsUrl', () => {
  it('parses handle from absolute collection URL', () => {
    assert.equal(
      extractCollectionHandleFromCmsUrl('https://www.kokobay.co.uk/collections/all-new-in'),
      'all-new-in',
    );
  });

  it('parses handle from relative path', () => {
    assert.equal(extractCollectionHandleFromCmsUrl('/collections/best-sellers'), 'best-sellers');
  });
});
