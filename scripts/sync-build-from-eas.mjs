#!/usr/bin/env node
/**
 * Align app.json build numbers with the highest EAS production build (iOS + Android).
 * Use before an Android-only release when iOS builds have run ahead of committed app.json.
 *
 * Usage:
 *   node scripts/sync-build-from-eas.mjs
 *   node scripts/sync-build-from-eas.mjs --dry-run
 */
import {
  getSharedBuildNumber,
  readAppJson,
  readPkgJson,
  setSharedBuildNumber,
  writeAppJson,
  writePkgJson,
} from "./lib/app-version.mjs";
import { summarizeEasBuildVersions } from "./lib/eas-build-version.mjs";

const dryRun = process.argv.includes("--dry-run");

const summary = summarizeEasBuildVersions();
const appJson = readAppJson();
const localBuild = getSharedBuildNumber(appJson);
const targetBuild = Math.max(summary.sharedMax, localBuild);
const targetVersion = summary.marketingVersion ?? appJson.expo?.version;

console.log("[version:sync-eas] EAS production builds:");
console.log(`  iOS latest max:     ${summary.iosMax} (${summary.latestIos?.appVersion ?? "?"})`);
console.log(`  Android latest max: ${summary.androidMax} (${summary.latestAndroid?.appVersion ?? "?"})`);
console.log(`  app.json local:     ${localBuild} (${appJson.expo?.version})`);
console.log(`  → target build:     ${targetBuild}`);
if (targetVersion) {
  console.log(`  → target version:   ${targetVersion}`);
}

if (dryRun) {
  console.log("[version:sync-eas] dry-run — no files changed");
  process.exit(0);
}

setSharedBuildNumber(appJson, targetBuild);
if (targetVersion) {
  appJson.expo.version = targetVersion;
}
writeAppJson(appJson);

const pkg = readPkgJson();
if (targetVersion) {
  pkg.version = targetVersion;
  writePkgJson(pkg);
}

console.log(`[version:sync-eas] Updated app.json + package.json to build ${targetBuild}`);
