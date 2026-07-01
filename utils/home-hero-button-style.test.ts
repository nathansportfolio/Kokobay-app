import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeHomeHeroButtonStyle } from '@/utils/home-hero-button-style';

describe('normalizeHomeHeroButtonStyle', () => {
  it('defaults to pill when unset', () => {
    assert.equal(normalizeHomeHeroButtonStyle(undefined), 'pill');
    assert.equal(normalizeHomeHeroButtonStyle(''), 'pill');
    assert.equal(normalizeHomeHeroButtonStyle('pill'), 'pill');
  });

  it('maps underline aliases', () => {
    assert.equal(normalizeHomeHeroButtonStyle('underline'), 'underline');
    assert.equal(normalizeHomeHeroButtonStyle('Underlined'), 'underline');
    assert.equal(normalizeHomeHeroButtonStyle('link'), 'underline');
    assert.equal(normalizeHomeHeroButtonStyle('text'), 'underline');
  });
});
