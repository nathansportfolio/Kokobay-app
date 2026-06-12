import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSharedBuildNumber, incrementBuildNumber, readAppJson, root, setSharedBuildNumber, writeAppJson } from "./app-version.mjs";
import { summarizeEasBuildVersions } from "./eas-build-version.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.join(__dirname, "..");

export function parseReleaseArgs(argv) {
  const args = argv.slice(2);
  return {
    noBump: args.includes("--no-bump"),
    buildOnly: args.includes("--build-only"),
    bumpArgs: args.filter((a) => a === "--minor" || a === "--major" || a === "--patch"),
  };
}

export function run(command, commandArgs) {
  console.log(`\n> ${command} ${commandArgs.join(" ")}\n`);
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function bumpMarketingVersionIfNeeded(noBump, bumpArgs) {
  if (noBump) return;
  run("node", [path.join(scriptsDir, "bump-app-version.mjs"), ...bumpArgs]);
}

/**
 * If iOS-only EAS builds ran ahead of committed app.json, pull local build numbers up first.
 */
export function syncBuildFromEasIfBehind() {
  try {
    const summary = summarizeEasBuildVersions();
    const appJson = readAppJson();
    const local = getSharedBuildNumber(appJson);
    const easMax = summary.sharedMax;

    if (easMax > local) {
      console.log(
        `[release] Local build ${local} is behind EAS max ${easMax} (iOS ${summary.iosMax}, Android ${summary.androidMax}) — syncing before increment`,
      );
      setSharedBuildNumber(appJson, easMax);
      if (summary.marketingVersion) {
        appJson.expo.version = summary.marketingVersion;
      }
      writeAppJson(appJson);
    }
  } catch (error) {
    console.warn(
      `[release] Could not sync build numbers from EAS (${error instanceof Error ? error.message : error}); using local app.json`,
    );
  }
}

export function incrementSharedBuildNumberIfNeeded(noIncrementBuild) {
  if (noIncrementBuild) return;
  syncBuildFromEasIfBehind();
  incrementBuildNumber();
}

export function readEasJson() {
  return JSON.parse(readFileSync(path.join(root, "eas.json"), "utf8"));
}

export function writeEasJson(eas) {
  writeFileSync(path.join(root, "eas.json"), `${JSON.stringify(eas, null, 2)}\n`);
}
