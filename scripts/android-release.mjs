#!/usr/bin/env node
/**
 * Bump marketing version, increment shared build number, build Android on EAS, and submit.
 *
 * For releases on both platforms, prefer `pnpm release:build` so versions stay in sync.
 *
 * Usage:
 *   node scripts/android-release.mjs
 *   node scripts/android-release.mjs --minor
 *   node scripts/android-release.mjs --no-bump           # increment build + build only
 *   node scripts/android-release.mjs --build-only        # bump version + build, no submit
 *   node scripts/android-release.mjs --no-increment-build # marketing bump + build, keep build number
 */
import {
  bumpMarketingVersionIfNeeded,
  incrementSharedBuildNumberIfNeeded,
  readEasJson,
  run,
  writeEasJson,
} from "./lib/release-utils.mjs";

const args = process.argv.slice(2);

const noBump = args.includes("--no-bump");
const buildOnly = args.includes("--build-only");
const noIncrementBuild = args.includes("--no-increment-build");
const bumpArgs = args.filter((a) => a === "--minor" || a === "--major" || a === "--patch");

const PLACEHOLDER = /PASTE_|REPLACE|YOUR_|__SET_/i;

function ensureServiceAccountKeyInEasJson(keyPath) {
  const eas = readEasJson();
  eas.submit ??= {};
  eas.submit.production ??= {};
  eas.submit.production.android ??= {};
  if (eas.submit.production.android.serviceAccountKeyPath === keyPath) return;
  eas.submit.production.android.serviceAccountKeyPath = keyPath;
  writeEasJson(eas);
}

function getServiceAccountKeyPath() {
  const fromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  if (fromEnv) {
    ensureServiceAccountKeyInEasJson(fromEnv);
    return fromEnv;
  }

  try {
    const keyPath = readEasJson().submit?.production?.android?.serviceAccountKeyPath;
    if (typeof keyPath === "string" && keyPath.trim() && !PLACEHOLDER.test(keyPath)) {
      return keyPath.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

bumpMarketingVersionIfNeeded(noBump, bumpArgs);
incrementSharedBuildNumberIfNeeded(noIncrementBuild);

const serviceAccountKeyPath = getServiceAccountKeyPath();
const wantsSubmit = !buildOnly;

const buildArgs = [
  "build",
  "--platform",
  "android",
  "--profile",
  "production",
  "--non-interactive",
];

if (wantsSubmit && serviceAccountKeyPath) {
  buildArgs.push("--auto-submit");
} else if (wantsSubmit) {
  console.warn(
    "\n[android-release] Skipping --auto-submit: set submit.production.android.serviceAccountKeyPath in eas.json\n" +
      "  (Google Play Console service account JSON), or export GOOGLE_SERVICE_ACCOUNT_KEY.\n" +
      "  After the build finishes: pnpm android:submit:latest\n",
  );
}

run("eas", buildArgs);

if (wantsSubmit && !serviceAccountKeyPath) {
  console.log(
    "\n[android-release] Build queued. When it finishes, submit with:\n" +
      "  pnpm android:submit:latest\n" +
      "  (after serviceAccountKeyPath is set in eas.json)\n",
  );
}
