#!/usr/bin/env node
/**
 * Increment the shared developer build number for iOS and Android.
 *
 * Usage:
 *   node scripts/increment-build-number.mjs
 */
import { incrementBuildNumber } from "./lib/app-version.mjs";

incrementBuildNumber();
