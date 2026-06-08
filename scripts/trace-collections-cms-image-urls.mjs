#!/usr/bin/env node
/**
 * Trace first 6 CMS collection image URLs through the app resize pipeline.
 */

const DEFAULT_API = 'https://kokobay-mizd.vercel.app';
const TARGET_WIDTH_CAP = 800;
const SCREEN_WIDTH = 390;
const PIXEL_RATIO = 3; // iPhone @3x typical
const LIMIT = 6;

const SHOPIFY_CDN_HOST_RE = /(?:^|\.)shopify(?:cdn)?\.com$|\.kokobay\.co\.uk$/i;

function isShopifyCdnUrl(url) {
  try {
    return SHOPIFY_CDN_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function shopCollectionCoverDeliveryWidth(screenWidth) {
  if (screenWidth == null || screenWidth <= 0) return TARGET_WIDTH_CAP;
  const devicePixels = Math.ceil(screenWidth * PIXEL_RATIO);
  const stepped = Math.ceil(devicePixels / 50) * 50;
  return Math.min(TARGET_WIDTH_CAP, Math.max(400, stepped));
}

function applyShopifyCdnImageParams(originalUrl, targetWidth, format) {
  const trimmed = originalUrl.trim();
  if (!trimmed || !isShopifyCdnUrl(trimmed)) return { url: trimmed, applied: false };
  const parsed = new URL(trimmed);
  parsed.searchParams.set('width', String(targetWidth));
  parsed.searchParams.set('format', format);
  return {
    url: parsed.toString(),
    applied: true,
    params: { width: String(targetWidth), format },
  };
}

function shopCollectionCoverUri(raw, screenWidth) {
  const originalUrl = raw.trim();
  if (!originalUrl) return { url: originalUrl, resized: false };
  const targetWidth = shopCollectionCoverDeliveryWidth(screenWidth);
  if (!isShopifyCdnUrl(originalUrl)) {
    return { url: originalUrl, resized: false, reason: 'non-shopify-host' };
  }
  const result = applyShopifyCdnImageParams(originalUrl, targetWidth, 'webp');
  return { ...result, resized: true, targetWidth };
}

function shopifyCdnUriForPlatform(uri, platform) {
  const trimmed = uri.trim();
  if (!trimmed || !isShopifyCdnUrl(trimmed)) return { url: trimmed, platformOverride: false };
  const isIosDev = platform === 'ios-dev';
  if (!isIosDev) return { url: trimmed, platformOverride: false };
  const parsed = new URL(trimmed);
  parsed.searchParams.set('format', 'png');
  return { url: parsed.toString(), platformOverride: true, format: 'png' };
}

async function probeUrl(url) {
  const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  const bytes = Number(res.headers.get('content-length') || 0);
  const type = res.headers.get('content-type') || '';
  return {
    ok: res.ok,
    status: res.status,
    bytes: Number.isFinite(bytes) ? bytes : null,
    contentType: type,
  };
}

function formatKb(bytes) {
  if (bytes == null) return '—';
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main() {
  const apiBase = (
    process.env.EXPO_PUBLIC_KOKOBAY_API_BASE_URL?.trim() || DEFAULT_API
  ).replace(/\/+$/, '');

  const headers = { Accept: 'application/json' };
  const apiKey = process.env.EXPO_PUBLIC_KOKOBAY_PRODUCTS_API_KEY?.trim();
  if (apiKey) headers['x-kokobay-products-api-key'] = apiKey;

  const res = await fetch(`${apiBase}/api/collections-cms`, { headers });
  if (!res.ok) throw new Error(`collections-cms ${res.status}`);
  const json = await res.json();
  const tiles = (Array.isArray(json) ? json : json.tiles || []).slice(0, LIMIT);

  const deliveryWidth = shopCollectionCoverDeliveryWidth(SCREEN_WIDTH);
  console.log(`API: ${apiBase}`);
  console.log(`Assumed device: screenWidth=${SCREEN_WIDTH}, pixelRatio=${PIXEL_RATIO}`);
  console.log(`shopCollectionCoverDeliveryWidth → ${deliveryWidth}px\n`);

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const original = (tile.imageUrl || tile.image_url || '').trim();
    const cover = shopCollectionCoverUri(original, SCREEN_WIDTH);
    const androidFinal = shopifyCdnUriForPlatform(cover.url, 'android');
    const iosDevFinal = shopifyCdnUriForPlatform(cover.url, 'ios-dev');

    const [origProbe, sizedProbe, iosProbe] = await Promise.all([
      probeUrl(original),
      probeUrl(androidFinal.url),
      probeUrl(iosDevFinal.url),
    ]);

    const origParams = new URL(original);
    const sizedParams = new URL(androidFinal.url);

    console.log(`--- Image ${i + 1}: ${tile.title} (${tile.slug}) ---`);
    console.log(`Original Shopify URL:\n  ${original}`);
    console.log(`CMS width/height: ${tile.imageWidth ?? tile.width ?? '—'} × ${tile.imageHeight ?? tile.height ?? '—'} (not passed from CMS API)`);
    console.log(`Shopify CDN resize applied? ${cover.resized ? 'YES' : 'NO'}`);
    if (cover.resized) {
      console.log(`  width=${cover.params.width}, format=${cover.params.format}`);
    }
    console.log(`After shopCollectionCoverUri (webp):\n  ${cover.url}`);
    console.log(`Final rendered URL (Android / iOS prod — webp):\n  ${androidFinal.url}`);
    console.log(`Final rendered URL (iOS __DEV__ — png override):\n  ${iosDevFinal.url}`);
    console.log(`Original upload size: ${formatKb(origProbe.bytes)} (${origProbe.contentType || origProbe.status})`);
    console.log(`Resized webp size:   ${formatKb(sizedProbe.bytes)} (${sizedProbe.contentType || sizedProbe.status})`);
    console.log(`Resized png (iOS dev): ${formatKb(iosProbe.bytes)} (${iosProbe.contentType || iosProbe.status})`);
    console.log(
      `Original query params: ${[...origParams.searchParams.entries()].map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}`,
    );
    console.log(
      `Final query params:    ${[...sizedParams.searchParams.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`,
    );
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
