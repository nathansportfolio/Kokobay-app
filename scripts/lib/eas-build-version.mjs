import { spawnSync } from "node:child_process";
import { root } from "./app-version.mjs";

/**
 * Parse `eas build:list --json` (warnings may precede the JSON array).
 */
export function parseEasBuildListJson(stdout) {
  const start = stdout.indexOf("[");
  if (start === -1) {
    throw new Error("eas build:list did not return JSON");
  }
  return JSON.parse(stdout.slice(start));
}

export function fetchEasProductionBuilds(platform, limit = 25) {
  const result = spawnSync(
    "eas",
    ["build:list", "--platform", platform, "--limit", String(limit), "--json", "--non-interactive"],
    { cwd: root, encoding: "utf8", env: process.env },
  );

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(`eas build:list --platform ${platform} failed: ${err || result.status}`);
  }

  return parseEasBuildListJson(result.stdout).filter(
    (build) =>
      build.status === "FINISHED" &&
      (build.buildProfile === "production" || build.distribution === "STORE"),
  );
}

export function maxEasBuildNumber(builds) {
  let max = 0;
  for (const build of builds) {
    const n = Number.parseInt(String(build.appBuildVersion ?? ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/** Latest finished production marketing version (prefers iOS ordering). */
export function latestEasMarketingVersion(iosBuilds) {
  const latest = iosBuilds[0];
  return typeof latest?.appVersion === "string" ? latest.appVersion.trim() : null;
}

export function summarizeEasBuildVersions() {
  const iosBuilds = fetchEasProductionBuilds("ios");
  const androidBuilds = fetchEasProductionBuilds("android");
  const iosMax = maxEasBuildNumber(iosBuilds);
  const androidMax = maxEasBuildNumber(androidBuilds);
  const marketingVersion = latestEasMarketingVersion(iosBuilds);

  return {
    iosMax,
    androidMax,
    sharedMax: Math.max(iosMax, androidMax),
    marketingVersion,
    latestIos: iosBuilds[0] ?? null,
    latestAndroid: androidBuilds[0] ?? null,
  };
}
