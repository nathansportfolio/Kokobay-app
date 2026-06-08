import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shopCollectionCoverUri } from '@/utils/shop-collection-cover-uri';

describe('shopCollectionCoverUri', () => {
  it('appends width and webp format to Shopify CDN URLs', () => {
    const original =
      'https://www.kokobay.co.uk/cdn/shop/collections/hero.jpg?v=1754496329';
    const out = shopCollectionCoverUri({
      url: original,
      width: 2400,
      height: 3000,
      screenWidth: 390,
    });
    const parsed = new URL(out);
    assert.equal(parsed.searchParams.get('format'), 'webp');
    assert.ok(Number(parsed.searchParams.get('width')) <= 800);
    assert.equal(parsed.pathname, '/cdn/shop/collections/hero.jpg');
  });

  it('replaces existing width and format params', () => {
    const original =
      'https://cdn.shopify.com/s/files/1/0000/collections/a.jpg?width=1600&format=jpg';
    const out = shopCollectionCoverUri({ url: original, screenWidth: 430 });
    const parsed = new URL(out);
    assert.equal(parsed.searchParams.get('format'), 'webp');
    assert.ok(Number(parsed.searchParams.get('width')) <= 800);
  });

  it('returns non-Shopify URLs unchanged', () => {
    const original = 'https://example.com/image.jpg';
    assert.equal(shopCollectionCoverUri({ url: original }), original);
  });

  it('resizes CMS collection file URLs from cdn.shopify.com', () => {
    const original =
      'https://cdn.shopify.com/s/files/1/0064/3828/9461/files/IMG_5737_2.jpg?v=1779960972';
    const out = shopCollectionCoverUri({ url: original, screenWidth: 390 });
    const parsed = new URL(out);
    assert.equal(parsed.searchParams.get('format'), 'webp');
    assert.equal(parsed.searchParams.get('width'), '800');
  });
});
