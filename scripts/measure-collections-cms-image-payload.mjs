#!/usr/bin/env node
/**
 * Measure CMS collection cover image payload before vs after Shopify CDN resize.
 * Uses the same width (~800px) + webp params as shopCollectionCoverUri.
 *
 * Usage: node scripts/measure-collections-cms-image-payload.mjs
 */

const SHOPIFY_CDN_HOST_RE = /(?:^|\.)shopify(?:cdn)?\.com$|\.kokobay\.co\.uk$/i;
const TARGET_WIDTH = 800;
const DEFAULT_API = 'https://kokobay-mizd.vercel.app';
const CONCURRENCY = 6;

function isShopifyCdnUrl(url) {
  try {
    return SHOPIFY_CDN_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function applyShopifyCdnImageParams(originalUrl, targetWidth, format = 'webp') {
  const trimmed = originalUrl.trim();
  if (!trimmed || !isShopifyCdnUrl(trimmed)) return trimmed;
  const parsed = new URL(trimmed);
  parsed.searchParams.set('width', String(targetWidth));
  parsed.searchParams.set('format', format);
  return parsed.toString();
}

function shopCollectionCoverUri(url, screenWidth = 390) {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (!isShopifyCdnUrl(trimmed)) return trimmed;
  const devicePixels = Math.ceil(screenWidth * 3);
  const stepped = Math.ceil(devicePixels / 50) * 50;
  const targetWidth = Math.min(TARGET_WIDTH, Math.max(400, stepped));
  return applyShopifyCdnImageParams(trimmed, targetWidth, 'webp');
}

async function headContentLength(url) {
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HEAD ${res.status} ${url}`);
  }
  const raw = res.headers.get('content-length');
  const bytes = raw ? Number(raw) : NaN;
  if (!Number.isFinite(bytes)) {
    throw new Error(`No content-length for ${url}`);
  }
  return bytes;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function summarize(rows) {
  const total = rows.reduce((sum, row) => sum + row.bytes, 0);
  const largest = rows.reduce((max, row) => (row.bytes > max.bytes ? row : max), rows[0]);
  return { total, largest, count: rows.length };
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main() {
  const apiBase = (
    process.env.EXPO_PUBLIC_KOKOBAY_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_KOKOBAY_API_URL?.trim() ||
    DEFAULT_API
  ).replace(/\/+$/, '');

  const headers = { Accept: 'application/json' };
  const apiKey = process.env.EXPO_PUBLIC_KOKOBAY_PRODUCTS_API_KEY?.trim();
  if (apiKey) {
    headers['x-kokobay-products-api-key'] = apiKey;
  }

  const cmsRes = await fetch(`${apiBase}/api/collections-cms`, { headers });
  if (!cmsRes.ok) {
    throw new Error(`collections-cms ${cmsRes.status}`);
  }

  const cmsJson = await cmsRes.json();
  const tiles = Array.isArray(cmsJson) ? cmsJson : Array.isArray(cmsJson?.tiles) ? cmsJson.tiles : [];
  const imageUrls = tiles
    .map((tile) => {
      const raw =
        typeof tile?.imageUrl === 'string'
          ? tile.imageUrl
          : typeof tile?.image_url === 'string'
            ? tile.image_url
            : '';
      return raw.trim();
    })
    .filter(Boolean);

  if (!imageUrls.length) {
    console.log('No CMS collection image URLs found.');
    return;
  }

  console.log(`API: ${apiBase}`);
  console.log(`Tiles with images: ${imageUrls.length}\n`);

  const beforeRows = await mapPool(imageUrls, CONCURRENCY, async (url) => ({
    url,
    bytes: await headContentLength(url),
  }));

  const afterRows = await mapPool(imageUrls, CONCURRENCY, async (url) => {
    const resized = shopCollectionCoverUri(url);
    return {
      url: resized,
      bytes: await headContentLength(resized),
    };
  });

  const before = summarize(beforeRows);
  const after = summarize(afterRows);

  const firstSevenBefore = summarize(beforeRows.slice(0, 7));
  const firstSevenAfter = summarize(afterRows.slice(0, 7));

  console.log('=== All CMS collection images ===');
  console.log(`Total payload before: ${formatKb(before.total)} (${before.total} bytes)`);
  console.log(`Total payload after:  ${formatKb(after.total)} (${after.total} bytes)`);
  console.log(
    `Reduction: ${(((before.total - after.total) / before.total) * 100).toFixed(1)}%`,
  );
  console.log(`Largest image before: ${formatKb(before.largest.bytes)} — ${before.largest.url}`);
  console.log(`Largest image after:  ${formatKb(after.largest.bytes)} — ${after.largest.url}`);

  console.log('\n=== First ~7 visible rows (typical initial viewport) ===');
  console.log(`Total payload before: ${formatKb(firstSevenBefore.total)}`);
  console.log(`Total payload after:  ${formatKb(firstSevenAfter.total)}`);

  console.log('\n=== Per-tile ===');
  for (let i = 0; i < imageUrls.length; i++) {
    const b = beforeRows[i];
    const a = afterRows[i];
    const pct = (((b.bytes - a.bytes) / b.bytes) * 100).toFixed(0);
    console.log(
      `${i + 1}. ${formatKb(b.bytes)} → ${formatKb(a.bytes)} (−${pct}%)`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
