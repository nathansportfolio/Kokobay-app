import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyShopifyCdnImageParams, shopifyCdnUriForPlatform } from '@/utils/shopify-cdn-image';

describe('shopifyCdnUriForPlatform', () => {
  it('returns non-Shopify URLs unchanged', () => {
    const url = 'https://example.com/photo.jpg';
    assert.equal(shopifyCdnUriForPlatform(url), url);
  });
});

describe('applyShopifyCdnImageParams', () => {
  it('appends width and format for Shopify CDN URLs', () => {
    const original = 'https://cdn.shopify.com/s/files/1/0000/products/a.jpg?v=1';
    const out = applyShopifyCdnImageParams(original, 400, 'webp');
    const parsed = new URL(out);
    assert.equal(parsed.searchParams.get('width'), '400');
    assert.equal(parsed.searchParams.get('format'), 'webp');
  });

  it('can request png to avoid ICC metadata from Shopify JPEG/WebP', () => {
    const original = 'https://www.kokobay.co.uk/cdn/shop/collections/hero.jpg?v=1';
    const out = applyShopifyCdnImageParams(original, 300, 'png');
    assert.equal(new URL(out).searchParams.get('format'), 'png');
  });
});
