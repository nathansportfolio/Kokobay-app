import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isHomePath,
  pdpRelatedProductReturnTo,
  productHref,
  shouldFollowProductReturnTo,
} from '@/utils/product-navigation';

describe('product navigation', () => {
  it('detects home paths', () => {
    assert.equal(isHomePath('/'), true);
    assert.equal(isHomePath('/(tabs)'), true);
    assert.equal(isHomePath('/collection/sale'), false);
  });

  it('chains related PDP returnTo through the current product', () => {
    assert.equal(
      pdpRelatedProductReturnTo('/product/dress-a', '/collection/new-in'),
      '/product/dress-a?returnTo=%2Fcollection%2Fnew-in',
    );
  });

  it('chains related PDP without an outer PLP when opened from home', () => {
    assert.equal(pdpRelatedProductReturnTo('/product/dress-a'), '/product/dress-a');
  });

  it('builds product href with nested returnTo', () => {
    assert.equal(
      productHref('dress-b', '/product/dress-a?returnTo=/collection/new-in'),
      '/product/dress-b?returnTo=%2Fproduct%2Fdress-a%3FreturnTo%3D%2Fcollection%2Fnew-in',
    );
  });

  it('follows explicit returnTo for PLP and chained PDP targets', () => {
    assert.equal(shouldFollowProductReturnTo('/collection/new-in'), true);
    assert.equal(shouldFollowProductReturnTo('/product/dress-a'), true);
    assert.equal(shouldFollowProductReturnTo('/wishlist'), true);
    assert.equal(shouldFollowProductReturnTo(undefined), false);
  });
});
