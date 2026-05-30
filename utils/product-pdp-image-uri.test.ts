import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  productPdpGalleryImageUri,
  productPdpLightboxImageUri,
} from '@/utils/product-pdp-image-uri';

describe('productPdpImageUri', () => {
  const base =
    'https://www.kokobay.co.uk/cdn/shop/files/product.jpg?v=1';

  it('gallery URI caps width and uses webp', () => {
    const out = productPdpGalleryImageUri({
      url: base,
      screenWidth: 390,
      width: 3000,
      height: 4000,
    });
    const parsed = new URL(out);
    assert.equal(parsed.searchParams.get('format'), 'webp');
    assert.ok(Number(parsed.searchParams.get('width')) <= 1200);
  });

  it('lightbox URI allows higher delivery width than gallery', () => {
    const gallery = new URL(
      productPdpGalleryImageUri({ url: base, screenWidth: 430, width: 3000 }),
    );
    const lightbox = new URL(
      productPdpLightboxImageUri({ url: base, screenWidth: 430, width: 3000 }),
    );
    assert.ok(Number(lightbox.searchParams.get('width')) >= Number(gallery.searchParams.get('width')));
    assert.ok(Number(lightbox.searchParams.get('width')) <= 1600);
  });
});
