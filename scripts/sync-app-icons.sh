#!/usr/bin/env bash
# Copies Easy App Icon export into Expo source assets (app.json + app.config.ts).
# Requires macOS `sips`. After running, rebuild native apps (EAS or expo prebuild --clean).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EASY="${ROOT}/assets/easyappicon-icons-1780052605816"
IOS_1024="${EASY}/ios/AppIcon.appiconset/ItunesArtwork@2x.png"
ANDROID_FG="${EASY}/android/mipmap-xxxhdpi/ic_launcher_foreground.png"
OUT_ICON="${ROOT}/assets/images/icon.png"
OUT_ADAPTIVE="${ROOT}/assets/images/android-adaptive-foreground.png"
OUT_FAVICON="${ROOT}/assets/images/favicon.png"

if [[ ! -f "$IOS_1024" ]]; then
  echo "Missing Easy App Icon export: $IOS_1024" >&2
  echo "Drop a new easyappicon-icons-* folder under assets/ and update EASY in this script." >&2
  exit 1
fi

cp "$IOS_1024" "$OUT_ICON"
echo "Wrote $OUT_ICON (1024 — iOS + Expo icon + notification icon)"

if [[ -f "$ANDROID_FG" ]]; then
  sips -z 1024 1024 "$ANDROID_FG" --out "$OUT_ADAPTIVE" >/dev/null
  echo "Wrote $OUT_ADAPTIVE (Android adaptive foreground)"
fi

sips -z 192 192 "$OUT_ICON" --out "$OUT_FAVICON" >/dev/null
echo "Wrote $OUT_FAVICON (web favicon)"

echo "Next: pnpm ios:eas:build  (and/or android:eas:build) — icon changes need a native rebuild."
