#!/usr/bin/env node
/**
 * Bump marketing version, increment shared build number, build iOS on EAS, and submit.
 *
 * For releases on both platforms, prefer `pnpm release:build` so versions stay in sync.
 *
 * Usage:
 *   node scripts/ios-release.mjs
 *   node scripts/ios-release.mjs --minor
 *   node scripts/ios-release.mjs --no-bump           # increment build + build only
 *   node scripts/ios-release.mjs --build-only        # bump version + build, no submit
 *   node scripts/ios-release.mjs --no-increment-build # marketing bump + build, keep build number
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

const ASC_PLACEHOLDER = /PASTE_|REPLACE|YOUR_|__SET_/i;

function ensureAscAppIdInEasJson(id) {
  const eas = readEasJson();
  eas.submit ??= {};
  eas.submit.production ??= {};
  eas.submit.production.ios ??= {};
  if (eas.submit.production.ios.ascAppId === id) return;
  eas.submit.production.ios.ascAppId = id;
  writeEasJson(eas);
}

function getAscAppId() {
  const fromEnv = process.env.ASC_APP_ID?.trim();
  if (fromEnv) {
    ensureAscAppIdInEasJson(fromEnv);
    return fromEnv;
  }

  try {
    const id = readEasJson().submit?.production?.ios?.ascAppId;
    if (typeof id === "string" && id.trim() && !ASC_PLACEHOLDER.test(id)) {
      return id.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

bumpMarketingVersionIfNeeded(noBump, bumpArgs);
incrementSharedBuildNumberIfNeeded(noIncrementBuild);

const ascAppId = getAscAppId();
const wantsSubmit = !buildOnly;

const buildArgs = [
  "build",
  "--platform",
  "ios",
  "--profile",
  "production",
  "--non-interactive",
];

if (wantsSubmit && ascAppId) {
  buildArgs.push("--auto-submit");
} else if (wantsSubmit) {
  console.warn(
    "\n[ios-release] Skipping --auto-submit: set submit.production.ios.ascAppId in eas.json\n" +
      "  (App Store Connect → Koko Bay → App Information → Apple ID), or export ASC_APP_ID.\n" +
      "  After the build finishes: pnpm ios:submit:latest\n",
  );
}

run("eas", buildArgs);

if (wantsSubmit && !ascAppId) {
  console.log(
    "\n[ios-release] Build queued. When it finishes, submit with:\n" +
      "  pnpm ios:submit:latest\n" +
      "  (after ascAppId is set in eas.json)\n",
  );
}
