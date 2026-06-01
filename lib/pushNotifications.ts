/**
 * Koko Bay mobile push notifications (Expo Push Service + Koko Bay backend).
 *
 * ## Expo push flow
 * 1. This app requests OS notification permission and obtains an **Expo push token**
 *    (`ExponentPushToken[...]`) tied to the EAS project in `app.json` / `app.config`.
 * 2. The token is sent to Koko Bay `POST /api/push/register` with the signed-in customer email,
 *    or a stable per-device anonymous email until the user signs in.
 * 3. When marketing/ops or automations need to notify a user, the **backend** calls Expo's
 *    Push API with that token — not the app. The app only registers tokens and handles taps.
 *
 * ## Why the backend manages delivery
 * - Campaigns, order updates, and back-in-stock alerts run server-side with Shopify/web data.
 * - Tokens are rotated per device; central registration avoids duplicate sends from the client.
 * - Secrets (Expo access token, audience rules) stay on Vercel, not in the mobile binary.
 *
 * ## Expo Router deep linking
 * `resolvePushDeepLink()` maps notification `data` to **file-based routes** under `app/`:
 * `/products/[handle]`, `/collections/[handle]`, `/account/orders/[orderId]`, etc.
 * Those screens forward into the tab navigator where the real UI lives.
 *
 * ## Cold start flow (app fully closed)
 * 1. User taps notification → OS launches the app.
 * 2. Root layout mounts → `setupPushNotificationListeners()` runs.
 * 3. `Notifications.getLastNotificationResponseAsync()` returns the tap that launched the app.
 * 4. We resolve the payload and call `navigate(href, { replace: true })` so the user lands on
 *    the target screen without a bogus "back" to an empty root.
 * 5. The same response may also arrive on `addNotificationResponseReceivedListener` — deduped
 *    by a stable notification response key (see `handledResponseKeys`).
 *
 * ## Notification response handling (foreground / background)
 * - **Foreground delivery**: `addNotificationReceivedListener` — log only; banner via
 *   `setNotificationHandler`. No auto-navigation (user has not tapped yet).
 * - **Background / foreground tap**: `addNotificationResponseReceivedListener` → navigate.
 *
 * @see https://docs.expo.dev/push-notifications/overview/
 * @see https://docs.expo.dev/router/reference/linking/
 */

import Constants from 'expo-constants';
import type * as Notifications from 'expo-notifications';
import { getDeviceLabel, isPhysicalDevice } from '@/lib/expo-device-safe';
import { getExpoNotifications, isExpoGoClient } from '@/lib/expo-notifications-safe';
import { InteractionManager, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Href } from 'expo-router';

import { resolveDeepLinkUrl } from '@/lib/deep-link-router';
import { resolveKokobayApiBaseUrl } from '@/services/kokobay-web/api-config';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

const PUSH_REGISTRATION_CACHE_KEY = 'kokobay_push_registration_v1';
const ANONYMOUS_PUSH_EMAIL_KEY = 'kokobay_push_anonymous_email_v1';
const ANONYMOUS_PUSH_EMAIL_SUFFIX = '@anonymous.kokobay';
const ANDROID_DEFAULT_CHANNEL_ID = 'default';

/** Fallback when payload is missing or invalid (home tab). */
export const PUSH_FALLBACK_HREF = '/(tabs)' as Href;

export type PushPlatform = 'ios' | 'android';

export type PushRegistrationPayload = {
  email: string;
  expoPushToken: string;
  platform: PushPlatform;
  deviceName: string;
};

export type PushRegistrationResult =
  | { ok: true; expoPushToken: string; skipped?: boolean }
  | { ok: false; reason: PushRegistrationFailureReason; message: string };

export type PushRegistrationFailureReason =
  | 'simulator'
  | 'permission_denied'
  | 'no_project_id'
  | 'invalid_token'
  | 'network'
  | 'server';

/** Supported `data.route` values from Koko Bay push payloads. */
export type PushRouteType =
  | 'product'
  | 'collection'
  | 'order'
  | 'content'
  | 'wishlist'
  | 'cart'
  | 'back_in_stock';

/**
 * Notification `data` from Koko Bay / Expo Push.
 *
 * @example Back in stock — `{ "route": "product", "handle": "black-bikini" }`
 * @example Sale collection — `{ "route": "collection", "handle": "sale" }`
 * @example Order shipped — `{ "route": "order", "orderId": "12345" }`
 */
export type PushNotificationData = {
  route?: PushRouteType | string;
  handle?: string;
  slug?: string;
  productHandle?: string;
  collectionHandle?: string;
  orderId?: string;
  orderNumber?: string;
  /** Koko Bay store URL, app path, or `kokobay://` / `kokobayapp://` link. */
  url?: string;
  /** Same as `url` when the backend sends `deepLink` at the root of the push job. */
  deepLink?: string;
  /** Opaque campaign tag from Koko Bay (string in Expo `data`). */
  campaignType?: string;
};

export type ResolvePushDeepLinkResult = {
  /** Expo Router href, or null when unroutable. */
  href: Href | null;
  /** Canonical app path for logging (e.g. `/products/black-bikini`). */
  canonicalPath: string | null;
  /** Why routing failed — only set when `href` is null. */
  reason?: string;
  /** Safe destination when primary route is invalid. */
  fallbackHref: Href;
};

type CachedPushRegistration = PushRegistrationPayload & {
  registeredAt: number;
};

export type PushListenerCleanup = () => void;

export type PushNavigationSource = 'cold_start' | 'notification_tap' | 'foreground_received';

export type PushNotificationNavigate = (
  href: Href,
  options?: { replace?: boolean; source?: PushNavigationSource },
) => void;

/** Prevents duplicate navigation when cold-start and tap listener both fire. */
const handledResponseKeys = new Set<string>();

type PendingPushNavigation = {
  dedupeKey: string;
  href: Href;
  navigate: PushNotificationNavigate;
  options?: { replace?: boolean; source?: PushNavigationSource };
};

/** Router / navigator must be mounted (fonts + stack) before push() works reliably. */
let pushNavigationReady = false;
let pendingPushNavigation: PendingPushNavigation | null = null;
let activePushNavigate: PushNotificationNavigate | null = null;
let coldStartNotificationHandled = false;

function pushApiOrigin(): string {
  return resolveKokobayApiBaseUrl({ fallbackToDefault: true })!;
}

function pushApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${pushApiOrigin()}${p}`;
}

function easProjectId(): string | undefined {
  const fromExtra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return (
    fromExtra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | null)?.projectId ??
    undefined
  );
}

function normalizeEmail(email: string | undefined | null): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed && trimmed.includes('@') ? trimmed : null;
}

function isAnonymousPushEmail(email: string): boolean {
  return email.endsWith(ANONYMOUS_PUSH_EMAIL_SUFFIX);
}

function randomPushDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/** Stable guest identity for Koko Bay push registration before sign-in. */
async function getOrCreateAnonymousPushEmail(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(ANONYMOUS_PUSH_EMAIL_KEY);
    if (existing && existing.includes('@')) {
      return existing.toLowerCase();
    }
  } catch {
    /* generate below */
  }

  const email = `device+${randomPushDeviceId().replace(/-/g, '')}${ANONYMOUS_PUSH_EMAIL_SUFFIX}`;
  try {
    await SecureStore.setItemAsync(ANONYMOUS_PUSH_EMAIL_KEY, email);
  } catch (e) {
    pushDebug('anonymous email cache write failed', e);
  }
  return email;
}

async function resolveRegistrationEmail(emailInput?: string | null): Promise<string> {
  const signedInEmail = normalizeEmail(emailInput);
  if (signedInEmail) return signedInEmail;
  return getOrCreateAnonymousPushEmail();
}

function registrationFingerprint(payload: PushRegistrationPayload): string {
  return [payload.email, payload.expoPushToken, payload.platform, payload.deviceName].join('|');
}

function pushDebug(_message: string, _extra?: unknown): void {}

function pushNavLog(_message: string, _extra?: Record<string, unknown>): void {}

function hrefToLogString(href: Href): string {
  if (typeof href === 'string') return href;
  try {
    return JSON.stringify(href);
  } catch {
    return String(href);
  }
}

/** URL-safe path segment (handles, slugs, order ids). */
function pathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function normalizeRoute(route: string | undefined): string {
  return (route ?? '').trim().toLowerCase().replace(/-/g, '_');
}

function responseDedupeKey(
  notification: Notifications.Notification,
  actionIdentifier?: string,
): string {
  return `${notification.request.identifier}::${actionIdentifier ?? 'default'}`;
}

async function readCachedRegistration(): Promise<CachedPushRegistration | null> {
  try {
    const raw = await SecureStore.getItemAsync(PUSH_REGISTRATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPushRegistration;
    if (
      typeof parsed.email === 'string' &&
      typeof parsed.expoPushToken === 'string' &&
      typeof parsed.platform === 'string' &&
      typeof parsed.deviceName === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeCachedRegistration(payload: PushRegistrationPayload): Promise<void> {
  try {
    const cached: CachedPushRegistration = { ...payload, registeredAt: Date.now() };
    await SecureStore.setItemAsync(PUSH_REGISTRATION_CACHE_KEY, JSON.stringify(cached));
  } catch (e) {
    pushDebug('cache write failed', e);
  }
}

async function clearCachedRegistration(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PUSH_REGISTRATION_CACHE_KEY);
  } catch {
    /* no key */
  }
}

/** Human-readable device label for the Koko Bay device registry. */
export function getPushDeviceName(): string {
  return getDeviceLabel();
}

export function getPushPlatform(): PushPlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/**
 * Creates the Android notification channel (required on API 26+).
 * Safe to call multiple times; no-op on iOS.
 */
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (isExpoGoClient()) return;

  const Notifications = getExpoNotifications();
  if (!Notifications || Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL_ID, {
    name: 'Koko Bay',
    description: 'Order updates, back in stock, and client care messages',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#8E6E66',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

/**
 * Requests permission and returns an Expo push token, or `null` when unavailable.
 */
export async function obtainExpoPushToken(): Promise<
  | { ok: true; token: string }
  | { ok: false; reason: PushRegistrationFailureReason; message: string }
> {
  if (isExpoGoClient()) {
    return {
      ok: false,
      reason: 'invalid_token',
      message: 'Push notifications require a development or production build (not Expo Go).',
    };
  }

  const Notifications = getExpoNotifications();
  if (!Notifications) {
    return {
      ok: false,
      reason: 'invalid_token',
      message: 'Push notifications require a rebuild with expo-notifications installed.',
    };
  }

  if (!isPhysicalDevice()) {
    return {
      ok: false,
      reason: 'simulator',
      message: 'Push notifications require a physical device (not a simulator).',
    };
  }

  await ensureAndroidNotificationChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return {
      ok: false,
      reason: 'permission_denied',
      message: 'Notification permission was denied.',
    };
  }

  const projectId = easProjectId();
  if (!projectId) {
    return {
      ok: false,
      reason: 'no_project_id',
      message: 'Missing EAS projectId in app config (extra.eas.projectId).',
    };
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data?.trim();
    if (!token || !token.startsWith('ExponentPushToken[')) {
      return {
        ok: false,
        reason: 'invalid_token',
        message: 'Expo returned an invalid push token.',
      };
    }
    return { ok: true, token };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to get Expo push token.';
    pushDebug('getExpoPushTokenAsync failed', e);
    return {
      ok: false,
      reason: 'invalid_token',
      message,
    };
  }
}

async function postPushRegister(payload: PushRegistrationPayload): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(pushApiUrl('/api/push/register'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const preview = (await res.text()).slice(0, 400);
      pushDebug('register HTTP error', { status: res.status, preview });
      return false;
    }
    return true;
  } catch (e) {
    pushDebug('register network error', e);
    return false;
  }
}

/**
 * Registers this device with Koko Bay when permission is granted.
 * Works signed out (anonymous device email) or signed in (customer email).
 * Skips duplicate POSTs when email, token, platform, and device name are unchanged.
 */
export async function registerPushNotifications(
  emailInput?: string | null,
): Promise<PushRegistrationResult> {
  if (isExpoGoClient()) {
    return {
      ok: false,
      reason: 'invalid_token',
      message: 'Push notifications require a development or production build (not Expo Go).',
    };
  }

  const email = await resolveRegistrationEmail(emailInput);

  const tokenResult = await obtainExpoPushToken();
  if (!tokenResult.ok) {
    return { ok: false, reason: tokenResult.reason, message: tokenResult.message };
  }

  const payload: PushRegistrationPayload = {
    email,
    expoPushToken: tokenResult.token,
    platform: getPushPlatform(),
    deviceName: getPushDeviceName(),
  };

  const cached = await readCachedRegistration();
  if (
    cached &&
    isAnonymousPushEmail(cached.email) &&
    !isAnonymousPushEmail(payload.email) &&
    cached.expoPushToken
  ) {
    await postPushUnregister(cached);
    await clearCachedRegistration();
  } else if (cached && registrationFingerprint(cached) === registrationFingerprint(payload)) {
    return { ok: true, expoPushToken: payload.expoPushToken, skipped: true };
  }

  const registered = await postPushRegister(payload);
  if (!registered) {
    return {
      ok: false,
      reason: 'network',
      message: 'Could not register push token with Koko Bay. Try again later.',
    };
  }

  await writeCachedRegistration(payload);
  return { ok: true, expoPushToken: payload.expoPushToken };
}

async function postPushUnregister(payload: PushRegistrationPayload): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(pushApiUrl('/api/push/unregister'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      pushDebug('unregister HTTP error', { status: res.status });
    }
    return res.ok;
  } catch (e) {
    pushDebug('unregister network error', e);
    return false;
  }
}

/**
 * Removes the device token from Koko Bay (call on sign-out).
 * Clears local registration cache even if the network call fails.
 */
export async function unregisterPushNotifications(
  emailInput?: string | null,
): Promise<void> {
  if (isExpoGoClient()) return;

  const email = normalizeEmail(emailInput);
  const cached = await readCachedRegistration();

  const payload: PushRegistrationPayload | null = cached
    ? cached
    : email
      ? {
          email,
          expoPushToken: '',
          platform: getPushPlatform(),
          deviceName: getPushDeviceName(),
        }
      : null;

  if (payload?.expoPushToken) {
    await postPushUnregister(payload);
  }

  await clearCachedRegistration();
}

/** Foreground presentation — show banner/list while app is open. */
export function configureForegroundNotificationHandling(): void {
  if (isExpoGoClient()) return;

  const Notifications = getExpoNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function asPushDataString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

/** Unwrap common Expo / FCM payload shapes into a flat record. */
function flattenPushDataRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const nested = raw.data;
  const fromNested =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : null;

  let merged: Record<string, unknown> = fromNested ? { ...fromNested, ...raw } : { ...raw };

  const body = asPushDataString(raw.body);
  if (body?.startsWith('{')) {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        merged = { ...(parsed as Record<string, unknown>), ...merged };
      }
    } catch {
      /* ignore */
    }
  }

  return merged;
}

export function extractPushData(
  notification: Notifications.Notification,
): PushNotificationData {
  let raw: unknown = notification.request.content.data;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const record = flattenPushDataRecord(raw as Record<string, unknown>);

  return {
    route: asPushDataString(record.route),
    handle: asPushDataString(record.handle),
    slug: asPushDataString(record.slug),
    productHandle: asPushDataString(record.productHandle),
    collectionHandle: asPushDataString(record.collectionHandle),
    orderId: asPushDataString(record.orderId),
    orderNumber: asPushDataString(record.orderNumber),
    url:
      asPushDataString(record.url) ??
      asPushDataString(record.deepLink) ??
      asPushDataString(record.link),
    deepLink: asPushDataString(record.deepLink),
    campaignType: asPushDataString(record.campaignType),
  };
}

/** Product PDP. */
function productPushHref(handle: string): Href {
  return `/product/${handle.trim()}` as Href;
}

/** Collection PLP. */
function collectionPushHref(handle: string): Href {
  return `/collection/${handle.trim()}` as Href;
}

async function clearLastNotificationResponse(): Promise<void> {
  if (isExpoGoClient()) return;

  const Notifications = getExpoNotifications();
  if (!Notifications?.clearLastNotificationResponseAsync) return;
  try {
    await Notifications.clearLastNotificationResponseAsync();
  } catch (e) {
    pushDebug('clearLastNotificationResponseAsync failed', e);
  }
}

/** Call when Expo Router / root stack is mounted (e.g. after fonts load). */
export function setPushNavigationReady(ready: boolean): void {
  pushNavigationReady = ready;
  if (ready) {
    flushPendingPushNavigation();
    retryColdStartPushNavigation();
  }
}

function flushPendingPushNavigation(): void {
  if (!pushNavigationReady || !pendingPushNavigation) return;

  const pending = pendingPushNavigation;
  pendingPushNavigation = null;

  if (handledResponseKeys.has(pending.dedupeKey)) {
    pushNavLog('skipped deferred navigation (already handled)', {
      destination: hrefToLogString(pending.href),
    });
    return;
  }

  handledResponseKeys.add(pending.dedupeKey);
  pushNavLog('flushing deferred push navigation', {
    destination: hrefToLogString(pending.href),
    source: pending.options?.source ?? null,
  });
  schedulePushNavigation(pending.navigate, pending.href, pending.options);
}

/** Re-attempt launch-from-notification once the root navigator exists (once per app session). */
function retryColdStartPushNavigation(): void {
  if (coldStartNotificationHandled) return;

  const Notifications = getExpoNotifications();
  const navigate = activePushNavigate;
  if (!Notifications || !navigate) return;

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response?.notification) return;
    const dedupeKey = responseDedupeKey(
      response.notification,
      response.actionIdentifier,
    );
    if (handledResponseKeys.has(dedupeKey)) {
      coldStartNotificationHandled = true;
      return;
    }

    pushNavLog('retrying cold-start navigation after app ready');
    const handled = navigateFromPushNotification(
      response.notification,
      navigate,
      'cold_start',
      response.actionIdentifier,
    );
    if (handled) {
      coldStartNotificationHandled = true;
    }
  });
}

function schedulePushNavigation(
  navigate: PushNotificationNavigate,
  href: Href,
  options?: { replace?: boolean; source?: PushNavigationSource },
): void {
  const destination = hrefToLogString(href);
  const run = () => {
    pushNavLog('navigating now', {
      destination,
      replace: Boolean(options?.replace),
      source: options?.source ?? 'unknown',
    });
    try {
      navigate(href, options);
      pushNavLog('navigation call completed', { destination });
      if (options?.source === 'cold_start' || options?.source === 'notification_tap') {
        void clearLastNotificationResponse();
      }
    } catch (error) {
      pushNavLog('navigation call failed', {
        destination,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const delayMs = options?.source === 'cold_start' ? 450 : 0;

  if (delayMs > 0) {
    pushNavLog('scheduling cold-start navigation', { destination, delayMs });
    InteractionManager.runAfterInteractions(() => {
      setTimeout(run, delayMs);
    });
    return;
  }

  InteractionManager.runAfterInteractions(run);
}

function resolvePathFromUrl(url: string): ResolvePushDeepLinkResult | null {
  const resolved = resolveDeepLinkUrl(url);
  if (resolved.kind === 'unhandled' && !resolved.href) {
    return {
      href: null,
      canonicalPath: resolved.canonicalPath,
      reason: resolved.reason,
      fallbackHref: PUSH_FALLBACK_HREF,
    };
  }

  return {
    href: resolved.href ?? resolved.fallbackHref,
    canonicalPath: resolved.canonicalPath,
    fallbackHref: resolved.fallbackHref,
  };
}

/**
 * Maps notification `data` to Expo Router paths.
 *
 * @example Product — `{ route: "product", handle: "black-bikini" }` → `/product/black-bikini`
 * @example Store URL — `{ url: "https://www.kokobay.co.uk/products/black-bikini" }` → same PDP
 * @example Collection — `{ route: "collection", handle: "sale" }` → `/collections/sale`
 * @example Order — `{ route: "order", orderId: "12345" }` → `/account/orders/12345`
 * @example Content — `{ route: "content", slug: "shipping-policy" }` → `/content/shipping-policy`
 * @example Wishlist — `{ route: "wishlist" }` → `/wishlist`
 * @example Cart — `{ route: "cart" }` → `/cart`
 */
export function resolvePushDeepLink(data: PushNotificationData): ResolvePushDeepLinkResult {
  if (data.url?.trim()) {
    const fromUrl = resolvePathFromUrl(data.url);
    if (fromUrl?.href) {
      pushNavLog('resolved destination from url', {
        url: data.url,
        destination: hrefToLogString(fromUrl.href),
      });
      pushDebug('resolved from url', { url: data.url, href: fromUrl.href });
      return fromUrl;
    }
    pushNavLog('url did not resolve, trying route fields', {
      url: data.url,
      reason: fromUrl?.reason ?? 'unparseable_url',
      route: data.route ?? null,
      handle: data.handle ?? null,
    });
  }

  const route = normalizeRoute(data.route);
  const productHandle = (data.handle ?? data.productHandle)?.trim();
  const collectionHandle = (data.collectionHandle ?? data.handle)?.trim();
  const orderId = data.orderId?.trim();
  const slug = data.slug?.trim();

  switch (route) {
    case 'product':
    case 'products':
    case 'back_in_stock':
    case 'backinstock': {
      if (!productHandle) {
        return {
          href: null,
          canonicalPath: null,
          reason: 'missing_product_handle',
          fallbackHref: PUSH_FALLBACK_HREF,
        };
      }
      const canonicalPath = `/products/${pathSegment(productHandle)}`;
      return {
        href: productPushHref(productHandle),
        canonicalPath,
        fallbackHref: PUSH_FALLBACK_HREF,
      };
    }

    case 'collection':
    case 'collections': {
      if (!collectionHandle) {
        return {
          href: null,
          canonicalPath: null,
          reason: 'missing_collection_handle',
          fallbackHref: PUSH_FALLBACK_HREF,
        };
      }
      const canonicalPath = `/collections/${pathSegment(collectionHandle)}`;
      return {
        href: collectionPushHref(collectionHandle),
        canonicalPath,
        fallbackHref: PUSH_FALLBACK_HREF,
      };
    }

    case 'order':
    case 'orders': {
      if (!orderId) {
        const orderNumber = data.orderNumber?.trim();
        if (orderNumber) {
          return {
            href: {
              pathname: '/(tabs)/account',
              params: { orderNumber },
            } as Href,
            canonicalPath: '/(tabs)/account',
            fallbackHref: '/(tabs)/account' as Href,
          };
        }
        return {
          href: null,
          canonicalPath: null,
          reason: 'missing_order_id',
          fallbackHref: '/(tabs)/account' as Href,
        };
      }
      const canonicalPath = `/account/orders/${pathSegment(orderId)}`;
      return { href: canonicalPath as Href, canonicalPath, fallbackHref: '/(tabs)/account' as Href };
    }

    case 'content':
    case 'cms': {
      if (!slug) {
        return {
          href: null,
          canonicalPath: null,
          reason: 'missing_content_slug',
          fallbackHref: PUSH_FALLBACK_HREF,
        };
      }
      const canonicalPath = `/content/${pathSegment(slug)}`;
      return { href: canonicalPath as Href, canonicalPath, fallbackHref: PUSH_FALLBACK_HREF };
    }

    case 'wishlist': {
      const canonicalPath = '/wishlist';
      return {
        href: '/(tabs)/wishlist' as Href,
        canonicalPath,
        fallbackHref: PUSH_FALLBACK_HREF,
      };
    }

    case 'cart':
    case 'bag': {
      const canonicalPath = '/cart';
      return {
        href: '/(tabs)/cart' as Href,
        canonicalPath,
        fallbackHref: PUSH_FALLBACK_HREF,
      };
    }

    case '':
      return {
        href: null,
        canonicalPath: null,
        reason: 'missing_route',
        fallbackHref: PUSH_FALLBACK_HREF,
      };

    default:
      return {
        href: null,
        canonicalPath: null,
        reason: `unknown_route:${route}`,
        fallbackHref: PUSH_FALLBACK_HREF,
      };
  }
}

/**
 * Navigate from a notification tap (or cold start).
 * Uses fallback href when the primary route is invalid.
 */
export function navigateFromPushNotification(
  notification: Notifications.Notification,
  navigate: PushNotificationNavigate,
  source: PushNavigationSource,
  actionIdentifier?: string,
): boolean {
  const dedupeKey = responseDedupeKey(notification, actionIdentifier);
  if (handledResponseKeys.has(dedupeKey)) {
    pushDebug('skip duplicate navigation', { dedupeKey, source });
    return false;
  }

  const data = extractPushData(notification);
  const resolved = resolvePushDeepLink(data);
  const target = resolved.href ?? resolved.fallbackHref;
  const replace = false;
  const destination = hrefToLogString(target);
  const navOptions = { replace, source };

  pushNavLog('notification tap resolved', {
    source,
    rawData: data,
    resolvedHref: resolved.href ? hrefToLogString(resolved.href) : null,
    fallbackHref: hrefToLogString(resolved.fallbackHref),
    willNavigateTo: destination,
    usingFallback: resolved.href == null,
    reason: resolved.reason ?? null,
    canonicalPath: resolved.canonicalPath,
    replace,
    navigationReady: pushNavigationReady,
  });

  pushDebug('navigate', {
    source,
    data,
    canonicalPath: resolved.canonicalPath,
    reason: resolved.reason,
    href: target,
    replace,
  });

  if (!pushNavigationReady) {
    pendingPushNavigation = { dedupeKey, href: target, navigate, options: navOptions };
    pushNavLog('navigation deferred until app ready', { destination });
    return true;
  }

  handledResponseKeys.add(dedupeKey);
  schedulePushNavigation(navigate, target, navOptions);
  return true;
}

/**
 * Subscribes to foreground delivery, background/foreground taps, and cold-start tap.
 * Call once from the root layout when Expo Router is mounted.
 */
export function setupPushNotificationListeners(
  navigate: PushNotificationNavigate,
): PushListenerCleanup {
  if (isExpoGoClient()) {
    pushDebug('expo-notifications skipped in Expo Go');
    return () => {};
  }

  const Notifications = getExpoNotifications();
  if (!Notifications) {
    pushDebug('expo-notifications native module unavailable — listeners skipped');
    return () => {};
  }

  activePushNavigate = navigate;
  configureForegroundNotificationHandling();

  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = extractPushData(notification);
    pushNavLog('notification received (not navigating until tap)', data);
    pushDebug('received (foreground/background delivery)', data);
    // Do not auto-navigate on delivery — wait for explicit user tap.
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateFromPushNotification(
      response.notification,
      navigate,
      'notification_tap',
      response.actionIdentifier,
    );
  });

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response?.notification) {
      pushNavLog('no cold-start notification response');
      return;
    }
    if (coldStartNotificationHandled) return;
    pushNavLog('processing cold-start notification tap');
    const handled = navigateFromPushNotification(
      response.notification,
      navigate,
      'cold_start',
      response.actionIdentifier,
    );
    if (handled) {
      coldStartNotificationHandled = true;
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
    if (activePushNavigate === navigate) {
      activePushNavigate = null;
    }
  };
}

/** Clears dedupe keys (tests / dev reload). */
export function resetPushNavigationDedupe(): void {
  handledResponseKeys.clear();
}

/**
 * Re-register when Expo rotates the push token (rare; e.g. reinstall, OS update).
 */
export function addPushTokenRefreshListener(
  emailInput?: string | null,
): PushListenerCleanup {
  if (isExpoGoClient()) {
    return () => {};
  }

  const Notifications = getExpoNotifications();
  if (!Notifications) {
    return () => {};
  }

  const sub = Notifications.addPushTokenListener(() => {
    void registerPushNotifications(emailInput);
  });

  return () => sub.remove();
}
