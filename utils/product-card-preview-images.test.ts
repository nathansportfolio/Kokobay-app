import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { productCardPreviewImages } from '@/utils/product-card-preview-images';

describe('productCardPreviewImages', () => {
  it('returns empty when there are no valid images', () => {
    assert.deepEqual(productCardPreviewImages({ images: [] }), []);
    assert.deepEqual(
      productCardPreviewImages({ images: [{ url: 'not-a-url' }] }),
      [],
    );
  });

  it('returns one image when only one is valid', () => {
    const out = productCardPreviewImages({
      images: [
        { id: '1', url: 'https://cdn.example.com/a.jpg' },
        { url: 'bad' },
      ],
    });
    assert.equal(out.length, 1);
    assert.equal(out[0]?.key, '1');
  });

  it('caps at max and dedupes by id', () => {
    const out = productCardPreviewImages(
      {
        images: [
          { id: '1', url: 'https://cdn.example.com/1.jpg' },
          { id: '2', url: 'https://cdn.example.com/2.jpg' },
          { id: '1', url: 'https://cdn.example.com/1-dup.jpg' },
          { id: '3', url: 'https://cdn.example.com/3.jpg' },
          { id: '4', url: 'https://cdn.example.com/4.jpg' },
        ],
      },
      3,
    );
    assert.equal(out.length, 3);
    assert.deepEqual(
      out.map((img) => img.key),
      ['1', '2', '3'],
    );
  });
});
