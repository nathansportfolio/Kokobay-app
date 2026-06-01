#!/usr/bin/env node
/**
 * Generate Universal Links / App Links well-known files from env.
 *
 * Required env (process or `.env` in project root):
 *   EXPO_PUBLIC_APPLE_TEAM_ID — Apple Developer Team ID (10 chars)
 *   EXPO_PUBLIC_ANDROID_SHA256_FINGERPRINTS — comma-separated SHA-256 cert fingerprints
 *
 * Usage:
 *   node scripts/generate-well-known.mjs
 *   pnpm run well-known:generate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BUNDLE_ID = 'com.kokobay.kokobayapp';

function loadDotEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function formatFingerprint(raw) {
  const hex = raw.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (hex.length !== 64) {
    console.warn(`[generate-well-known] Warning: fingerprint "${raw}" is not 64 hex chars`);
  }
  return hex.match(/.{1,2}/g)?.join(':') ?? raw.trim();
}

loadDotEnv();

const teamId = (process.env.EXPO_PUBLIC_APPLE_TEAM_ID || process.env.APPLE_TEAM_ID || '').trim();
const fingerprintsRaw = (
  process.env.EXPO_PUBLIC_ANDROID_SHA256_FINGERPRINTS ||
  process.env.ANDROID_SHA256_FINGERPRINTS ||
  ''
).trim();

if (!teamId) {
  console.error(
    '[generate-well-known] Missing EXPO_PUBLIC_APPLE_TEAM_ID. Set it in .env and re-run.',
  );
  process.exit(1);
}

const fingerprints = fingerprintsRaw
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map(formatFingerprint);

if (fingerprints.length === 0) {
  console.error(
    '[generate-well-known] Missing EXPO_PUBLIC_ANDROID_SHA256_FINGERPRINTS (comma-separated). Set in .env and re-run.',
  );
  process.exit(1);
}

const appId = `${teamId}.${BUNDLE_ID}`;

const aasa = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: [appId],
        components: [
          { '/': '/products/*', comment: 'Product detail (Google Ads PDP)' },
          { '/': '/collections/*', comment: 'Collection PLP' },
          { '/': '/search', comment: 'Search PLP with query string' },
          { '/': '/search/*' },
          { '/': '/pages/*', comment: 'Promotional / policy landing pages' },
          { '/': '/content/*' },
          { '/': '/account/orders/*' },
          { '/': '/cart' },
          { '/': '/wishlist' },
          { '/': '/account' },
        ],
      },
    ],
  },
  webcredentials: {
    apps: [appId],
  },
};

const assetlinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: BUNDLE_ID,
      sha256_cert_fingerprints: fingerprints,
    },
  },
];

const wellKnownDir = path.join(root, 'public', '.well-known');
fs.mkdirSync(wellKnownDir, { recursive: true });

const aasaPath = path.join(wellKnownDir, 'apple-app-site-association');
const assetlinksPath = path.join(wellKnownDir, 'assetlinks.json');

fs.writeFileSync(aasaPath, `${JSON.stringify(aasa, null, 2)}\n`);
fs.writeFileSync(assetlinksPath, `${JSON.stringify(assetlinks, null, 2)}\n`);

console.log('[generate-well-known] Wrote:');
console.log(`  ${path.relative(root, aasaPath)}`);
console.log(`  ${path.relative(root, assetlinksPath)}`);
console.log(`  Apple Team ID: ${teamId}`);
console.log(`  Android fingerprints: ${fingerprints.length}`);
