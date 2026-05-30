import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { incrementBuildNumber, root } from "./app-version.mjs";

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

export function incrementSharedBuildNumberIfNeeded(noIncrementBuild) {
  if (noIncrementBuild) return;
  incrementBuildNumber();
}

export function readEasJson() {
  return JSON.parse(readFileSync(path.join(root, "eas.json"), "utf8"));
}

export function writeEasJson(eas) {
  writeFileSync(path.join(root, "eas.json"), `${JSON.stringify(eas, null, 2)}\n`);
}
