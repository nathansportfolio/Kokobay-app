# Koko Bay app — deep linking (Google Ads)

This app supports **custom scheme** links (`kokobay://`), **iOS Universal Links**, and **Android App Links** for `https://kokobay.co.uk` and `https://www.kokobay.co.uk`.

## App configuration

| Item | Value |
|------|--------|
| Custom scheme | `kokobay://` (legacy `kokobayapp://` still accepted) |
| iOS bundle ID | `com.kokobay.kokobayapp` |
| Android package | `com.kokobay.kokobayapp` |
| Router origin | `https://www.kokobay.co.uk` |

Configured in `app.json`, `app.config.ts`, and Expo Router (`extra.router`).

## Supported URLs

| Store URL | In-app destination |
|-----------|-------------------|
| `/products/{handle}` | Product tab `/(tabs)/product/{handle}` |
| `/collections/{handle}` | Collection tab `/(tabs)/collection/{handle}` |
| `/search?q={query}` | Search PLP `/(tabs)/search?q=…` |
| `/pages/{slug}` | Content shell `/content/{slug}` |
| `/account/orders/{id}` | Order deep link screen |
| `/cart`, `/wishlist`, `/account` | Matching tabs |

Parsing lives in [`lib/deep-link-router.ts`](../lib/deep-link-router.ts). Runtime handling:

- [`app/+native-intent.tsx`](../app/+native-intent.tsx) — rewrites paths before Expo Router matches routes (cold start / universal links).
- [`hooks/use-app-deep-linking.ts`](../hooks/use-app-deep-linking.ts) — `Linking.getInitialURL()` + `Linking.addEventListener('url')` for cold and warm opens.
- Push notifications reuse the same parser via [`lib/pushNotifications.ts`](../lib/pushNotifications.ts).

## Website files (required for Universal / App Links)

Host these at the **root** of the live store domain (both hosts should serve the same files):

```
https://kokobay.co.uk/.well-known/apple-app-site-association
https://www.kokobay.co.uk/.well-known/apple-app-site-association
https://kokobay.co.uk/.well-known/assetlinks.json
https://www.kokobay.co.uk/.well-known/assetlinks.json
```

Source copies are in [`public/.well-known/`](../public/.well-known/).

Generate them from `.env` (Team ID + Android SHA-256 fingerprints):

```bash
pnpm run well-known:generate
```

Set `EXPO_PUBLIC_APPLE_TEAM_ID` and `EXPO_PUBLIC_ANDROID_SHA256_FINGERPRINTS` in `.env` first — see [`.env.example`](../.env.example). Deploy the generated files to both store hosts before shipping a new native build.

### `apple-app-site-association`

1. Set `EXPO_PUBLIC_APPLE_TEAM_ID` in `.env` and run `pnpm run well-known:generate` (or replace `TEAM_ID` manually).
2. Final `appIDs` entry format: `{TEAM_ID}.com.kokobay.kokobayapp`
3. Serve with `Content-Type: application/json` (no file extension in the URL path).
4. No redirects on the AASA URL (Apple validates directly).

### `assetlinks.json`

1. Add SHA-256 certificate fingerprints for the signing keys that ship to Play / internal testing.

   ```bash
   # EAS production credentials
   eas credentials -p android

   # Or from a local release keystore
   keytool -list -v -keystore your-release.keystore -alias your-alias
   ```

2. Set `EXPO_PUBLIC_ANDROID_SHA256_FINGERPRINTS` (comma-separated) in `.env` and run `pnpm run well-known:generate` (or edit `assetlinks.json` manually).
3. Deploy to both `kokobay.co.uk` and `www.kokobay.co.uk`.

## Google Ads

Use **final URLs** on the store domain, for example:

- `https://www.kokobay.co.uk/products/{handle}`
- `https://www.kokobay.co.uk/collections/{handle}`
- `https://www.kokobay.co.uk/search?q={encoded-query}`
- `https://www.kokobay.co.uk/pages/{campaign-slug}`

Optional tracking template parameters are fine; paths and `q` must remain parseable.

Custom scheme fallbacks for diagnostics:

- `kokobay://products/{handle}`
- `kokobay://collections/{handle}`

## Rebuild native projects

After changing `app.config.ts`, regenerate native projects and ship a new build:

```bash
npx expo prebuild --clean
eas build --platform ios --profile production
eas build --platform android --profile production
```

## Testing

### iOS (Universal Links)

1. Install a **development or production** build (not Expo Go).
2. Confirm AASA is live:

   ```bash
   curl -I https://www.kokobay.co.uk/.well-known/apple-app-site-association
   ```

3. Open Notes or Messages, paste `https://www.kokobay.co.uk/products/{real-handle}`, long-press → **Open in Koko Bay** (should appear when association is valid).
4. Cold start: force-quit the app, tap the link → app opens on the product screen.
5. Warm start: app in background, tap the same link → navigates without duplicate home flash.
6. Custom scheme:

   ```bash
   xcrun simctl openurl booted "kokobay://products/{handle}"
   ```

7. View device logs in Metro: `[deep-link]` entries from `+native-intent` and the linking hook.

**If links open Safari:** AASA not deployed, Team ID mismatch, or app not reinstalled after entitlements change.

### Android (App Links)

1. Install a release or internal build with `android:autoVerify` intent filters (from `app.config.ts`).
2. Confirm `assetlinks.json` is live:

   ```bash
   curl https://www.kokobay.co.uk/.well-known/assetlinks.json
   ```

3. Verify domain ownership on device (Android 12+):

   ```bash
   adb shell pm get-app-links com.kokobay.kokobayapp
   ```

   Status should show `verified` for `kokobay.co.uk` / `www.kokobay.co.uk`.

4. Cold start:

   ```bash
   adb shell am start -a android.intent.action.VIEW \
     -d "https://www.kokobay.co.uk/products/{handle}"
   ```

5. Search link:

   ```bash
   adb shell am start -a android.intent.action.VIEW \
     -d "https://www.kokobay.co.uk/search?q=linen"
   ```

6. Custom scheme:

   ```bash
   adb shell am start -a android.intent.action.VIEW -d "kokobay://collections/sale"
   ```

**If links open Chrome:** `assetlinks.json` fingerprint mismatch, or verification not complete — reinstall after fixing hosting.

### Unit tests

```bash
node --import tsx --test lib/deep-link-router.test.ts
```

## Shopify hosting note

If the theme cannot serve `.well-known` directly, add reverse-proxy rules on your CDN (Vercel/Cloudflare) to serve the files from this repo’s `public/.well-known/` directory with `Cache-Control: public, max-age=300` and no redirects.
