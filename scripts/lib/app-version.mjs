import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.join(__dirname, "../..");
export const appJsonPath = path.join(root, "app.json");
export const pkgJsonPath = path.join(root, "package.json");

export function readAppJson() {
  return JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
}

export function writeAppJson(appJson) {
  fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`, "utf8");
}

export function readPkgJson() {
  return JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
}

export function writePkgJson(pkg) {
  fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

export function getSharedBuildNumber(appJson) {
  const ios = appJson.expo?.ios?.buildNumber;
  const android = appJson.expo?.android?.versionCode;
  const iosNum = ios != null && ios !== "" ? Number.parseInt(String(ios), 10) : null;
  const androidNum = android != null ? Number(android) : null;

  if (iosNum != null && androidNum != null && iosNum !== androidNum) {
    const max = Math.max(iosNum, androidNum);
    console.warn(
      `[app-version] iOS buildNumber (${iosNum}) and Android versionCode (${androidNum}) differ; syncing to ${max}`,
    );
    return max;
  }

  return iosNum ?? androidNum ?? 0;
}

export function setSharedBuildNumber(appJson, buildNumber) {
  appJson.expo.ios ??= {};
  appJson.expo.android ??= {};
  appJson.expo.ios.buildNumber = String(buildNumber);
  appJson.expo.android.versionCode = buildNumber;
}

export function syncPlatformBuildNumbers(appJson = readAppJson()) {
  const shared = getSharedBuildNumber(appJson);
  setSharedBuildNumber(appJson, shared);
  writeAppJson(appJson);
  return shared;
}

export function incrementBuildNumber() {
  const appJson = readAppJson();
  const current = getSharedBuildNumber(appJson);
  const next = current + 1;
  setSharedBuildNumber(appJson, next);
  writeAppJson(appJson);
  console.log(`[increment-build] ${current} → ${next} (iOS + Android)`);
  return next;
}
