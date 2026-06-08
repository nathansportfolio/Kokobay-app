#!/usr/bin/env node
/**
 * Simulates Collections tab SHOP_TAB_PERF timings using real network fetches.
 *
 * Model (from tab mount t=0):
 * - CMS fetch completes at cmsMs
 * - List paints ~RENDER_AFTER_DATA_MS later
 * - WITH prefetch: Image.prefetch starts at cmsMs (parallel for 6 covers)
 * - WITHOUT prefetch: image fetch starts when rows mount (cmsMs + RENDER)
 * - Cache hit onLoad overhead when prefetch finished before mount: CACHE_HIT_MS
 *
 * Usage:
 *   node scripts/measure-collections-viewport-timing.mjs
 *   node scripts/measure-collections-viewport-timing.mjs --runs=3
 */

const DEFAULT_API = 'https://kokobay-mizd.vercel.app';
const TARGET_WIDTH = 800;
const PREFETCH_COUNT = 6;
const RENDER_AFTER_DATA_MS = 32;
const CACHE_HIT_MS = 8;
const SCREEN_WIDTH = 390;

const SHOPIFY_CDN_HOST_RE = /(?:^|\.)shopify(?:cdn)?\.com$|\.kokobay\.co\.uk$/i;

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

function shopCollectionCoverUri(url, screenWidth = SCREEN_WIDTH) {
  const trimmed = url.trim();
  if (!trimmed || !isShopifyCdnUrl(trimmed)) return trimmed;
  const devicePixels = Math.ceil(screenWidth * 3);
  const stepped = Math.ceil(devicePixels / 50) * 50;
  const targetWidth = Math.min(TARGET_WIDTH, Math.max(400, stepped));
  return applyShopifyCdnImageParams(trimmed, targetWidth, 'webp');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCms(apiBase, headers, bust) {
  const started = performance.now();
  const res = await fetch(`${apiBase}/api/collections-cms?bust=${bust}`, {
    headers: { ...headers, 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) throw new Error(`collections-cms ${res.status}`);
  const json = await res.json();
  const tiles = Array.isArray(json) ? json : Array.isArray(json?.tiles) ? json.tiles : [];
  const cmsMs = performance.now() - started;
  const uris = tiles
    .slice(0, PREFETCH_COUNT)
    .map((tile) => {
      const raw = typeof tile?.imageUrl === 'string' ? tile.imageUrl : tile?.image_url;
      return raw ? shopCollectionCoverUri(raw) : '';
    })
    .filter(Boolean);
  return { cmsMs, uris };
}

async function downloadImage(uri, bust) {
  const started = performance.now();
  const url = uri.includes('?') ? `${uri}&bust=${bust}` : `${uri}?bust=${bust}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`image ${res.status} ${uri}`);
  await res.arrayBuffer();
  return performance.now() - started;
}

function average(values) {
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

async function simulateRun({ prefetch, apiBase, headers, bust }) {
  const { cmsMs, uris } = await fetchCms(apiBase, headers, bust);
  if (!uris.length) throw new Error('No collection image URIs');

  if (prefetch) {
    const downloads = uris.map(() => ({ done: false, atMs: 0 }));
    const tasks = uris.map((uri, index) =>
      downloadImage(uri, bust).then((durationMs) => {
        downloads[index] = { done: true, atMs: cmsMs + durationMs };
      }),
    );

    await sleep(RENDER_AFTER_DATA_MS);
    const renderAt = cmsMs + RENDER_AFTER_DATA_MS;

    await Promise.all(tasks);

    const onLoadTimes = downloads.map(({ atMs }) => {
      const prefetchedBeforeMount = atMs <= renderAt;
      return Math.round(Math.max(renderAt, atMs) + (prefetchedBeforeMount ? CACHE_HIT_MS : 0));
    });

    return {
      first_image_visible_ms: onLoadTimes[0],
      viewport_complete_ms: Math.max(...onLoadTimes),
      cmsMs: Math.round(cmsMs),
      imageCount: uris.length,
    };
  }

  await sleep(RENDER_AFTER_DATA_MS);
  const mountAt = cmsMs + RENDER_AFTER_DATA_MS;

  const durations = await Promise.all(uris.map((uri) => downloadImage(uri, bust)));
  const onLoadTimes = durations.map((durationMs) => Math.round(mountAt + durationMs));

  return {
    first_image_visible_ms: onLoadTimes[0],
    viewport_complete_ms: Math.max(...onLoadTimes),
    cmsMs: Math.round(cmsMs),
    imageCount: uris.length,
  };
}

async function runBatch(label, prefetch, runs, apiBase, headers) {
  const first = [];
  const viewport = [];

  for (let i = 0; i < runs; i++) {
    const bust = `${Date.now()}-${i}-${prefetch ? 'p' : 'n'}`;
    const result = await simulateRun({ prefetch, apiBase, headers, bust });
    first.push(result.first_image_visible_ms);
    viewport.push(result.viewport_complete_ms);
    console.log(
      `  run ${i + 1}: first_image_visible_ms=${result.first_image_visible_ms} viewport_complete_ms=${result.viewport_complete_ms} (cms=${result.cmsMs}ms, images=${result.imageCount})`,
    );
  }

  return {
    label,
    prefetch,
    runs: first.length,
    first_image_visible_ms_avg: average(first),
    viewport_complete_ms_avg: average(viewport),
    first_image_visible_ms: first,
    viewport_complete_ms: viewport,
  };
}

async function main() {
  const runsArg = process.argv.find((arg) => arg.startsWith('--runs='));
  const runs = runsArg ? Number(runsArg.split('=')[1]) : 3;

  const apiBase = (
    process.env.EXPO_PUBLIC_KOKOBAY_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_KOKOBAY_API_URL?.trim() ||
    DEFAULT_API
  ).replace(/\/+$/, '');

  const headers = { Accept: 'application/json' };
  const apiKey = process.env.EXPO_PUBLIC_KOKOBAY_PRODUCTS_API_KEY?.trim();
  if (apiKey) headers['x-kokobay-products-api-key'] = apiKey;

  console.log(`Collections viewport timing — ${runs} runs per mode`);
  console.log(`API: ${apiBase}`);
  console.log(`Model: render +${RENDER_AFTER_DATA_MS}ms after CMS, prefetch at cms complete\n`);

  console.log('WITHOUT prefetch');
  const without = await runBatch('without', false, runs, apiBase, headers);

  console.log('\nWITH prefetch');
  const withPrefetch = await runBatch('with', true, runs, apiBase, headers);

  console.log('\n=== Averages ===');
  console.log(
    `Without prefetch: first_image_visible_ms=${without.first_image_visible_ms_avg} viewport_complete_ms=${without.viewport_complete_ms_avg}`,
  );
  console.log(
    `With prefetch:    first_image_visible_ms=${withPrefetch.first_image_visible_ms_avg} viewport_complete_ms=${withPrefetch.viewport_complete_ms_avg}`,
  );

  const firstDelta = without.first_image_visible_ms_avg - withPrefetch.first_image_visible_ms_avg;
  const viewportDelta = without.viewport_complete_ms_avg - withPrefetch.viewport_complete_ms_avg;
  console.log(
    `Delta (without − with): first_image_visible_ms=${firstDelta}ms viewport_complete_ms=${viewportDelta}ms`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
