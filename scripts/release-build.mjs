#!/usr/bin/env node
/**
 * Bump marketing version once, increment shared build number once, then build
 * iOS and Android together so both stores always ship the same version.
 *
 * Usage:
 *   node scripts/release-build.mjs              # bump + build + submit (if configured)
 *   node scripts/release-build.mjs --build-only   # bump + build, no submit
 *   node scripts/release-build.mjs --no-bump      # rebuild current marketing version
 */
import {
  bumpMarketingVersionIfNeeded,
  incrementSharedBuildNumberIfNeeded,
  parseReleaseArgs,
  run,
} from "./lib/release-utils.mjs";

const { noBump, buildOnly, bumpArgs } = parseReleaseArgs(process.argv);

bumpMarketingVersionIfNeeded(noBump, bumpArgs);
incrementSharedBuildNumberIfNeeded(false);

const buildArgs = [
  "build",
  "--platform",
  "all",
  "--profile",
  "production",
  "--non-interactive",
];

if (!buildOnly) {
  buildArgs.push("--auto-submit");
}

run("eas", buildArgs);
