import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveHomeHeroCtaTarget } from '@/utils/home-hero-link';

describe('resolveHomeHeroCtaTarget', () => {
  it('maps kokobay.co.uk collection URLs to in-app collection routes', () => {
    const target = resolveHomeHeroCtaTarget(
      'https://www.kokobay.co.uk/collections/all-new-in',
      '/(tabs)',
    );
    assert.equal(target.kind, 'internal');
    if (target.kind === 'internal') {
      assert.equal(target.href, '/collection/all-new-in');
    }
  });

  it('keeps non-store https links external', () => {
    const target = resolveHomeHeroCtaTarget('https://example.com/sale', '/(tabs)');
    assert.equal(target.kind, 'external');
    if (target.kind === 'external') {
      assert.equal(target.url, 'https://example.com/sale');
    }
  });
});
