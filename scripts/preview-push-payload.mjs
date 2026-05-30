#!/usr/bin/env node
/**
 * Quick check that a Koko Bay push `data` object resolves to the expected app route.
 * Run: node scripts/preview-push-payload.mjs
 */

const payload = {
  url: 'https://www.kokobay.co.uk/products/the-sequin-mini-skirt-cream',
  productHandle: 'the-sequin-mini-skirt-cream',
  handle: 'the-sequin-mini-skirt-cream',
  route: 'product',
  campaignType: 'marketing',
};

const deepLink = 'https://www.kokobay.co.uk/products/the-sequin-mini-skirt-cream';

function resolveFromUrl(url) {
  const parsed = new URL(url.trim());
  const host = parsed.hostname.toLowerCase();
  if (
    host !== 'kokobay.co.uk' &&
    host !== 'www.kokobay.co.uk' &&
    !host.endsWith('.kokobay.co.uk')
  ) {
    return null;
  }
  const m = parsed.pathname.match(/^\/products\/([^/]+)\/?$/);
  if (!m?.[1]) return null;
  return `/products/${decodeURIComponent(m[1])}`;
}

function resolvePayload(data) {
  const url = data.url ?? data.deepLink;
  if (url) {
    const fromUrl = resolveFromUrl(url);
    if (fromUrl) return { href: fromUrl, via: 'url' };
  }
  const handle = (data.handle ?? data.productHandle)?.trim();
  if (data.route === 'product' && handle) {
    return { href: `/products/${encodeURIComponent(handle)}`, via: 'route+handle' };
  }
  return { href: null, via: 'fallback' };
}

console.log('--- payload in Expo `data` ---');
console.log(JSON.stringify(payload, null, 2));
console.log('\n--- job-level deepLink (must also be in `data` for the app) ---');
console.log(deepLink);
console.log('\n--- resolved app route ---');
console.log(resolvePayload(payload));
console.log('\n--- url-only (if backend omits route/handle) ---');
console.log(resolvePayload({ url: payload.url }));
console.log('\n--- deepLink-only ---');
console.log(resolvePayload({ deepLink }));
