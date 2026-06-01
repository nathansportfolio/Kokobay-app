import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deepLinkTargetHref, resolveDeepLinkUrl } from '@/lib/deep-link-router';

describe('resolveDeepLinkUrl', () => {
  it('maps storefront product URLs to tab product routes', () => {
    const result = resolveDeepLinkUrl('https://www.kokobay.co.uk/products/black-bikini');
    assert.equal(result.kind, 'product');
    assert.equal(deepLinkTargetHref(result), '/product/black-bikini');
    assert.equal(result.canonicalPath, '/products/black-bikini');
  });

  it('maps collection URLs', () => {
    const result = resolveDeepLinkUrl('https://kokobay.co.uk/collections/sale');
    assert.equal(result.kind, 'collection');
    assert.equal(deepLinkTargetHref(result), '/collection/sale');
  });

  it('maps search query URLs', () => {
    const result = resolveDeepLinkUrl('https://www.kokobay.co.uk/search?q=linen+dress');
    assert.equal(result.kind, 'search');
    const href = deepLinkTargetHref(result);
    assert.equal(typeof href, 'object');
    if (typeof href === 'object' && href && 'pathname' in href) {
      assert.equal(href.pathname, '/(tabs)/search');
      assert.equal(href.params?.q, 'linen dress');
    }
  });

  it('maps promotional Shopify pages', () => {
    const result = resolveDeepLinkUrl('https://www.kokobay.co.uk/pages/terms-conditions');
    assert.equal(result.kind, 'content');
    assert.equal(deepLinkTargetHref(result), '/content/terms-conditions');
  });

  it('accepts kokobay custom scheme links', () => {
    const result = resolveDeepLinkUrl('kokobay://products/blue-dress');
    assert.equal(result.kind, 'product');
    assert.equal(deepLinkTargetHref(result), '/product/blue-dress');
  });

  it('accepts legacy kokobayapp scheme links', () => {
    const result = resolveDeepLinkUrl('kokobayapp://collections/new-in');
    assert.equal(result.kind, 'collection');
  });

  it('rejects non-store hosts', () => {
    const result = resolveDeepLinkUrl('https://example.com/products/foo');
    assert.equal(result.kind, 'unhandled');
    assert.equal(result.href, null);
  });
});
