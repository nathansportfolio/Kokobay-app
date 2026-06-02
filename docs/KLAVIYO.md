# Klaviyo (React Native / Expo)

Klaviyo is integrated for **profiles and behavioral events** only. It does **not** replace:

- Expo push tokens or `expo-notifications`
- Koko Bay `POST /api/push/register`, `/api/push/send`, `/api/push/broadcast`
- Firebase Analytics or Crashlytics

Enable with env flags, rebuild the dev client / EAS binary (`expo prebuild` applies native changes), then use existing GTM helpers — Klaviyo mirrors the same data layer events.

---

## 1. Installation

Already in `package.json`:

```bash
pnpm add klaviyo-react-native-sdk klaviyo-expo-plugin
```

After changing native config or env:

```bash
npx expo prebuild --clean   # or EAS build
pnpm run ios:build          # local dev client
# or
pnpm run android:eas:build
```

Requires a **development build** or production binary — Klaviyo does not run in Expo Go.

---

## 2. Environment variables

Add to `.env` (and EAS secrets for production). Expo only inlines `EXPO_PUBLIC_*` at bundle time — restart Metro after changes.

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_KLAVIYO_ENABLED` | Yes | `true` / `1` / `yes` to enable (product name: **KLAVIYO_ENABLED**) |
| `EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY` | Yes | Klaviyo **public** Site ID / API key (Account → Settings → API keys) |

Example `.env`:

```bash
EXPO_PUBLIC_KLAVIYO_ENABLED=true
EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY=AbCd12
```

For EAS, set the same keys on your build profile (e.g. `eas.json` → `env`).

---

## 3. iOS configuration

Handled by `klaviyo-expo-plugin` in `app.config.ts` when Klaviyo is enabled:

- **No Klaviyo Notification Service Extension** (`includeNotificationServiceExtension: false`) so Expo/APNs push setup is unchanged.
- **No badge auto-clear** from Klaviyo (`badgeAutoclearing: false`).
- **Geofencing off** by default.

You still need a normal APNs setup for Expo push (existing EAS credentials). Klaviyo push token collection is **not** wired in this app.

Optional (Klaviyo dashboard): universal links for campaign attribution — see [klaviyo-expo-plugin Universal Links](https://github.com/klaviyo/klaviyo-expo-plugin#universal-links). Not required for event tracking.

---

## 4. Android configuration

Plugin settings in `app.config.ts`:

- `openTracking: false` — does not modify `MainActivity` for Klaviyo push-open tracking (Expo handles notification taps).
- `geofencingEnabled: false`
- Uses existing `minSdk` from Expo (23+ required by Klaviyo).

Rebuild Android after enabling. FCM for Expo push remains separate from Klaviyo.

---

## 5. What the app does

| Area | Implementation |
|------|----------------|
| Init | `initializeKlaviyo()` in `KlaviyoSync` on app start |
| Identify | `email` + Shopify `customerId` as `externalId` on login / session restore |
| Profile | `firstName`, `lastName`, `email`, `customerId` via `setProfile` |
| Logout | `resetKlaviyoProfile()` |
| Events | `trackDataLayerEventForKlaviyo()` from `pushToDataLayer` (same as GTM/Firebase) |

### Events tracked

| Metric | Trigger (existing code) |
|--------|-------------------------|
| Product Viewed | `trackViewItem` → PDP |
| Collection Viewed | `trackViewItemList` → collection PLP |
| Added To Cart | `trackAddToCart` → bag |
| Checkout Started | `trackBeginCheckout` → checkout bar |
| Order Placed | `trackPurchase` → checkout success |
| Wishlist Added | `trackAddToWishlist` → wishlist toggle |

### Dev logs

Filter Metro with `[KLAVIYO]`:

- `[KLAVIYO] status` — on every app launch (why Klaviyo is on/off)
- `[KLAVIYO] initialized` — SDK ready
- `[KLAVIYO] identify` — email, customerId
- `[KLAVIYO] event` — metric name + properties
- `[KLAVIYO] profile_update` — profile field changes
- `[KLAVIYO] skipped` — init failed (see `reason`)

If you see **no** `[KLAVIYO]` lines at all, reload the app after Metro restart. If you only see `status` with `nativeModule: false`, you must **rebuild the dev client** — Metro reload is not enough after adding the native SDK.

Use the **6-character Site ID** for `EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY` (e.g. `THMpay`), not the long `pk_…` private key.

---

## 6. Example usage

Most events need **no new calls** — keep using `@/lib/gtm`:

```typescript
import { trackViewItem, trackAddToCart, trackBeginCheckout, trackPurchase } from '@/lib/gtm';

// PDP
trackViewItem({ product, variant: selectedVariant, currency });

// Add to bag (also fired from BagProvider)
trackAddToCart({ handle, variantId, qty, title, unitPrice });

// Checkout
trackBeginCheckout(lines);
trackPurchase({ lines, transactionId, value, currency });
```

Direct Klaviyo API (custom flows, one-off metrics):

```typescript
import { trackKlaviyoEvent, KlaviyoMetric } from '@/lib/klaviyo';

trackKlaviyoEvent({
  name: KlaviyoMetric.productViewed,
  value: 49.99,
  properties: {
    ProductID: 'gid://shopify/ProductVariant/123',
    ProductName: 'Silk Dress',
    Currency: 'GBP',
  },
});
```

Identify is automatic when the user signs in. Manual profile update:

```typescript
import { updateKlaviyoProfileProperties } from '@/lib/klaviyo';

updateKlaviyoProfileProperties({
  email: user.email,
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
});
```

---

## 7. Push (explicitly out of scope)

Do **not** call `Klaviyo.setPushToken()` in this project. Device registration stays:

1. `expo-notifications` → Expo push token  
2. `lib/pushNotifications.ts` → `POST /api/push/register`

Klaviyo campaigns that need mobile push should continue to use your existing backend + Expo Push API, or a future dedicated Klaviyo push project with a clear migration plan.

---

## 8. Troubleshooting

| Symptom | Check |
|---------|--------|
| No `[KLAVIYO]` logs | `EXPO_PUBLIC_KLAVIYO_ENABLED=true`, rebuild dev client |
| SDK errors in Expo Go | Use dev client / EAS build, not Expo Go |
| Events missing | Confirm GTM path runs (`pushToDataLayer` / `trackViewItem`, etc.) |
| Wrong account | `EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY` matches Klaviyo account |
