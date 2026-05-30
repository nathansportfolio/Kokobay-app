import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dedupeProductsById } from '@/utils/kokobay-catalog-products';
import { productTileImageUri } from '@/utils/product-tile-image-uri';

describe('productTileImageUri', () => {
  it('appends width and webp for Shopify CDN URLs', () => {
    const original = 'https://cdn.shopify.com/s/files/1/0000/products/a.jpg?v=1';
    const out = productTileImageUri({
      url: original,
      tileWidth: 180,
      width: 2000,
      height: 2500,
    });
    const parsed = new URL(out);
    assert.equal(parsed.searchParams.get('format'), 'webp');
    assert.ok(Number(parsed.searchParams.get('width')) <= 600);
  });
});

describe('dedupeProductsById', () => {
  it('keeps first occurrence per id', () => {
    const a = {
      id: '1',
      handle: 'a',
      title: 'A',
      availableForSale: true,
      tags: [],
      images: [],
      priceRange: { minVariantPrice: { amount: '1', currencyCode: 'GBP' }, maxVariantPrice: { amount: '1', currencyCode: 'GBP' } },
      variants: [],
    };
    const b = { ...a, title: 'B' };
    const out = dedupeProductsById([a, b]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.title, 'A');
  });
});
