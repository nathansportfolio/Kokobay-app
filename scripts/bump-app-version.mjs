#!/usr/bin/env node
/**
 * Bump expo.version in app.json and sync package.json.
 * Keeps iOS buildNumber and Android versionCode aligned (does not increment them).
 *
 * Usage:
 *   node scripts/bump-app-version.mjs           # 1.0.0 → 1.0.1
 *   node scripts/bump-app-version.mjs --minor   # 1.0.1 → 1.1.0
 *   node scripts/bump-app-version.mjs --major   # 1.1.0 → 2.0.0
 */
import {
  readAppJson,
  readPkgJson,
  syncPlatformBuildNumbers,
  writeAppJson,
  writePkgJson,
} from "./lib/app-version.mjs";

function parseArgs() {
  if (process.argv.includes("--major")) return "major";
  if (process.argv.includes("--minor")) return "minor";
  return "patch";
}

function bumpSemver(version, part) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!match) {
    throw new Error(`Invalid semver in app.json: "${version}" (expected x.y.z)`);
  }
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  if (part === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (part === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

const part = parseArgs();
const appJson = readAppJson();
const current = appJson.expo?.version;

if (!current) {
  console.error("app.json is missing expo.version");
  process.exit(1);
}

syncPlatformBuildNumbers(appJson);

const next = bumpSemver(current, part);
appJson.expo.version = next;
writeAppJson(appJson);

const pkg = readPkgJson();
pkg.version = next;
writePkgJson(pkg);

console.log(`[bump-app-version] ${current} → ${next} (${part})`);
