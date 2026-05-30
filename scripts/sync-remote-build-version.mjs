#!/usr/bin/env node
/**
 * Align iOS buildNumber and Android versionCode in app.json to the same value.
 * Use when the two platforms have drifted apart.
 */
import { syncPlatformBuildNumbers } from "./lib/app-version.mjs";

const shared = syncPlatformBuildNumbers();
console.log(`[version:sync] Both platforms set to build number ${shared}`);
