#!/usr/bin/env node
/**
 * Android release verification checklist.
 *
 * Confirms production ABI targets, native library packaging, and New Architecture
 * settings before or after an EAS / Gradle release build.
 *
 * Usage:
 *   node scripts/verify-android-release.mjs
 *   node scripts/verify-android-release.mjs --prebuild
 *   node scripts/verify-android-release.mjs --artifact ./app-release.aab
 *   node scripts/verify-android-release.mjs --artifact ./app-release.apk
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const REQUIRED_ABIS = ['arm64-v8a', 'armeabi-v7a'];
const REQUIRED_LIB = 'libreactnative.so';

const args = process.argv.slice(2);
const shouldPrebuild = args.includes('--prebuild');
const artifactFlagIndex = args.indexOf('--artifact');
const artifactPath =
  artifactFlagIndex >= 0 ? path.resolve(root, args[artifactFlagIndex + 1] ?? '') : null;

if (artifactFlagIndex >= 0 && (!artifactPath || !fs.existsSync(artifactPath))) {
  console.error('verify-android-release: --artifact requires a path to an existing .aab or .apk');
  process.exit(1);
}

/** @type {{ id: string, label: string, status: 'pass' | 'fail' | 'skip', detail?: string }[]} */
const checks = [];

function addCheck(id, label, ok, detail) {
  checks.push({ id, label, status: ok ? 'pass' : 'fail', detail });
}

function addSkip(id, label, detail) {
  checks.push({ id, label, status: 'skip', detail });
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function readGradleProperty(contents, key) {
  const match = contents.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match?.[1]?.trim() ?? null;
}

function parseArchitectures(value) {
  return (value ?? '')
    .split(',')
    .map((abi) => abi.trim())
    .filter(Boolean);
}

function runPrebuild() {
  const result = spawnSync(
    'npx',
    ['expo', 'prebuild', '--platform', 'android', '--no-install'],
    { cwd: root, stdio: 'pipe', encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'expo prebuild failed');
  }
}

function resolveDefaultArtifact() {
  const candidates = [
    path.join(root, 'android/app/build/outputs/bundle/release/app-release.aab'),
    path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function listZipEntries(filePath) {
  const output = execSync(`unzip -Z1 ${JSON.stringify(filePath)}`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function findLibreactnativePaths(entries) {
  return entries.filter((entry) => entry.endsWith(`/${REQUIRED_LIB}`));
}

function abiFromNativeLibPath(entry) {
  const match = entry.match(/(?:^|\/)(lib|base\/lib)\/([^/]+)\/libreactnative\.so$/);
  return match?.[2] ?? null;
}

function verifyConfig() {
  const appJsonPath = path.join(root, 'app.json');
  const androidDir = path.join(root, 'android');
  const gradlePropsPath = path.join(androidDir, 'gradle.properties');
  const manifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');

  if (!fs.existsSync(appJsonPath)) {
    addCheck('app-json', 'app.json present', false, 'missing app.json');
    return;
  }

  const appJson = JSON.parse(readText(appJsonPath));
  const newArchInAppJson = appJson.expo?.newArchEnabled === true;
  addCheck(
    'new-arch-app-json',
    'New Architecture enabled in app.json',
    newArchInAppJson,
    `newArchEnabled=${String(appJson.expo?.newArchEnabled)}`,
  );

  let expoConfigOutput = '';
  try {
    expoConfigOutput = stripAnsi(
      execSync('npx expo config --type public', {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addCheck('expo-config', 'Expo config resolves', false, message);
    return;
  }

  addCheck('expo-config', 'Expo config resolves', true);
  addCheck(
    'legacy-packaging-config',
    'useLegacyPackaging=true in expo-build-properties',
    /useLegacyPackaging:\s*true/.test(expoConfigOutput),
    'expo config --type public',
  );

  if (!fs.existsSync(androidDir)) {
    if (shouldPrebuild) {
      runPrebuild();
    } else {
      addSkip(
        'android-native-project',
        'android/ project generated',
        'run with --prebuild or generate android/ before release verification',
      );
      return;
    }
  }

  if (!fs.existsSync(gradlePropsPath) || !fs.existsSync(manifestPath)) {
    addCheck('android-native-project', 'android/ project generated', false, 'missing gradle.properties or AndroidManifest.xml');
    return;
  }

  addCheck('android-native-project', 'android/ project generated', true);

  const gradleProps = readText(gradlePropsPath);
  const newArchInGradle = readGradleProperty(gradleProps, 'newArchEnabled') === 'true';
  addCheck(
    'new-arch-gradle',
    'New Architecture enabled in gradle.properties',
    newArchInGradle,
    `newArchEnabled=${readGradleProperty(gradleProps, 'newArchEnabled') ?? '(missing)'}`,
  );

  const legacyPackaging = readGradleProperty(gradleProps, 'expo.useLegacyPackaging') === 'true';
  addCheck(
    'legacy-packaging-gradle',
    'Legacy native packaging enabled (expo.useLegacyPackaging=true)',
    legacyPackaging,
    `expo.useLegacyPackaging=${readGradleProperty(gradleProps, 'expo.useLegacyPackaging') ?? '(missing)'}`,
  );

  const architectures = parseArchitectures(readGradleProperty(gradleProps, 'reactNativeArchitectures'));
  for (const abi of REQUIRED_ABIS) {
    addCheck(
      `abi-config-${abi}`,
      `${abi} listed in reactNativeArchitectures`,
      architectures.includes(abi),
      `reactNativeArchitectures=${architectures.join(',') || '(missing)'}`,
    );
  }

  const manifest = readText(manifestPath);
  const extractNativeLibs = /android:extractNativeLibs="true"/.test(manifest);
  addCheck(
    'extract-native-libs-manifest',
    'extractNativeLibs=true in AndroidManifest.xml',
    extractNativeLibs,
    extractNativeLibs ? 'android:extractNativeLibs="true"' : 'attribute missing or not true',
  );

  const buildGradlePath = path.join(androidDir, 'app/build.gradle');
  if (fs.existsSync(buildGradlePath)) {
    const buildGradle = readText(buildGradlePath);
    addCheck(
      'legacy-packaging-build-gradle',
      'app/build.gradle wires expo.useLegacyPackaging',
      /expo\.useLegacyPackaging/.test(buildGradle) && /useLegacyPackaging/.test(buildGradle),
      'packagingOptions.jniLibs.useLegacyPackaging',
    );
  }

  const mergedManifestPath = path.join(
    androidDir,
    'app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml',
  );
  if (fs.existsSync(mergedManifestPath)) {
    const mergedManifest = readText(mergedManifestPath);
    addCheck(
      'extract-native-libs-merged',
      'extractNativeLibs=true in merged release manifest',
      /android:extractNativeLibs="true"/.test(mergedManifest),
      mergedManifestPath,
    );
  } else {
    addSkip(
      'extract-native-libs-merged',
      'extractNativeLibs=true in merged release manifest',
      'run ./gradlew :app:processReleaseMainManifest to generate merged manifest',
    );
  }
}

function verifyArtifact(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.aab' && ext !== '.apk') {
    addCheck('artifact-format', 'Artifact is .aab or .apk', false, filePath);
    return;
  }

  addCheck('artifact-format', 'Artifact is .aab or .apk', true, path.relative(root, filePath));

  const entries = listZipEntries(filePath);
  const libPaths = findLibreactnativePaths(entries);
  addCheck(
    'libreactnative-packaged',
    `${REQUIRED_LIB} packaged in artifact`,
    libPaths.length > 0,
    libPaths.length > 0 ? libPaths.join(', ') : `no ${REQUIRED_LIB} entries found`,
  );

  const abisFound = new Set(libPaths.map((entry) => abiFromNativeLibPath(entry)).filter(Boolean));
  for (const abi of REQUIRED_ABIS) {
    addCheck(
      `abi-artifact-${abi}`,
      `${abi}: ${REQUIRED_LIB} present`,
      abisFound.has(abi),
      abisFound.has(abi) ? `found in artifact` : `missing from ${path.basename(filePath)}`,
    );
  }
}

function printReport() {
  const statusSymbol = { pass: 'PASS', fail: 'FAIL', skip: 'SKIP' };
  console.log('Android Release Verification Checklist');
  console.log('====================================\n');

  for (const check of checks) {
    const symbol = statusSymbol[check.status];
    const detail = check.detail ? ` — ${check.detail}` : '';
    console.log(`[${symbol}] ${check.label}${detail}`);
  }

  const failed = checks.filter((check) => check.status === 'fail').length;
  const skipped = checks.filter((check) => check.status === 'skip').length;
  const passed = checks.filter((check) => check.status === 'pass').length;

  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  if (failed > 0) {
    process.exit(1);
  }
}

verifyConfig();

const artifactToVerify = artifactPath ?? resolveDefaultArtifact();
if (artifactToVerify) {
  verifyArtifact(artifactToVerify);
} else {
  addSkip(
    'artifact-verification',
    'Release artifact ABI / libreactnative.so checks',
    'pass --artifact <path-to.aab|.apk> after EAS build, or build locally and re-run',
  );
}

printReport();
