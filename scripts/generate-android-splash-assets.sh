#!/usr/bin/env bash
# Regenerates Android splash + adaptive foregrounds with safe circular padding.
# Requires macOS `sips`. Run after changing logo art, then: npx expo prebuild --clean -p android
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/assets/images/splash-icon.png"
OUT_SPLASH="${ROOT}/assets/images/android-splash-logo.png"
OUT_ADAPTIVE="${ROOT}/assets/images/android-adaptive-foreground.png"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [[ ! -f "$SRC" ]]; then
  echo "Missing source: $SRC" >&2
  exit 1
fi

# ~56% of 1024 — fits Android 12+ circular splash mask (was 380)
sips -z 570 570 "$SRC" --out "$WORK/splash-scaled.png" >/dev/null
sips -p 1024 1024 --padColor FFFFFF "$WORK/splash-scaled.png" --out "$OUT_SPLASH" >/dev/null

# ~68% of 1024 — adaptive icon safe zone (~70%)
sips -z 700 700 "$SRC" --out "$WORK/adaptive-scaled.png" >/dev/null
sips -p 1024 1024 --padColor FFFFFF "$WORK/adaptive-scaled.png" --out "$OUT_ADAPTIVE" >/dev/null

echo "Wrote $OUT_SPLASH"
echo "Wrote $OUT_ADAPTIVE"
echo "Next: npx expo prebuild --clean -p android  (or EAS Android build)"
