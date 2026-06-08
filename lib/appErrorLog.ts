import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getAppErrorScreen, getAppErrorUserId } from '@/lib/app-error-context';
import { getDeviceLabel, isPhysicalDevice } from '@/lib/expo-device-safe';

import { reportErrorToFirebaseCrashlytics } from '@/src/lib/firebase-crashlytics';

import { legacyApiPostFireAndForget } from '@/src/core/api';
import { isKokobayApiConfigured } from '@/services/kokobay-web/api-config';

const REPORT_DEDUPE_MS = 12_000;
const recentReports = new Map<string, number>();

/** POST /api/app/error-log — not GET /api/app-error (incident banner). */
const ERROR_LOG_PATH = '/api/app/error-log';

const IMPORTANT_ERROR_SOURCES = new Set([
  'crash_guard',
  'error_boundary',
  'unhandled_promise_rejection',
  'expo_router_root_error_boundary',
]);

function apiConfigured(): boolean {
  return isKokobayApiConfigured();
}

export type ReportAppErrorInput = {
  message: string;
  level?: 'error' | 'warn' | 'info';
  fatal?: boolean;
  /** When true, always POST to `/api/app/error-log`. */
  important?: boolean;
  name?: string;
  stack?: string;
  screen?: string;
  userId?: string;
  context?: Record<string, unknown>;
};

function appVersionMeta() {
  return {
    appVersion:
      Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? undefined,
    buildNumber:
      Constants.expoConfig?.ios?.buildNumber ??
      Constants.expoConfig?.android?.versionCode?.toString() ??
      Constants.nativeBuildVersion ??
      undefined,
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    environment: __DEV__ ? 'development' : 'production',
    deviceName: isPhysicalDevice() ? getDeviceLabel() : 'Simulator',
  };
}

function reportDedupeKey(input: ReportAppErrorInput): string {
  return [input.level ?? 'error', input.message, input.stack?.slice(0, 160) ?? ''].join('|');
}

function shouldSendReport(key: string): boolean {
  const now = Date.now();
  const last = recentReports.get(key);
  if (last != null && now - last < REPORT_DEDUPE_MS) return false;
  recentReports.set(key, now);
  return true;
}

function errorContextSource(context?: Record<string, unknown>): string | undefined {
  const source = context?.source;
  return typeof source === 'string' ? source : undefined;
}

/** Only crashes, fatals, and explicitly important errors hit the API. */
export function shouldReportAppErrorToApi(input: ReportAppErrorInput): boolean {
  if (input.important === true || input.fatal === true) return true;
  const source = errorContextSource(input.context);
  if (source && IMPORTANT_ERROR_SOURCES.has(source)) return true;
  return false;
}

function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (Object.keys(out).length >= 18) break;
    if (value == null || typeof value === 'boolean' || typeof value === 'number') {
      out[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      out[key] = value.slice(0, 500);
      continue;
    }
    try {
      out[key] = JSON.stringify(value).slice(0, 500);
    } catch {
      out[key] = '[unserializable]';
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Reports to Firebase Crashlytics when configured; POSTs to Koko Bay only for important errors.
 * @see ERROR_LOG_PATH (`/api/app/error-log`) — not `GET /api/app-error` (Shopify incident banner).
 */
export function reportAppError(input: ReportAppErrorInput): void {
  const message = input.message.trim().slice(0, 2000);
  if (!message) return;

  const sendToApi = shouldReportAppErrorToApi(input);
  const dedupeKey = reportDedupeKey({ ...input, message });

  if (sendToApi && !shouldSendReport(dedupeKey)) return;

  const screen = input.screen ?? getAppErrorScreen();
  const userId = input.userId ?? getAppErrorUserId();
  const runtimeContext = sanitizeContext({
    reportedAt: new Date().toISOString(),
    osVersion: Platform.Version,
    ...input.context,
  });

  const payload = {
    ...appVersionMeta(),
    message,
    level: input.level ?? 'error',
    fatal: Boolean(input.fatal),
    ...(input.name ? { name: input.name.slice(0, 120) } : {}),
    ...(input.stack ? { stack: input.stack.slice(0, 8000) } : {}),
    ...(screen ? { screen: screen.slice(0, 240) } : {}),
    ...(userId ? { userId: userId.slice(0, 128) } : {}),
    ...(runtimeContext ? { context: runtimeContext } : {}),
  };

  reportErrorToFirebaseCrashlytics(input);

  if (!sendToApi) return;

  if (!apiConfigured()) return;

  legacyApiPostFireAndForget(ERROR_LOG_PATH, payload, {
    auth: 'none',
    marketQuery: false,
  });
}

export function reportAppErrorFromUnknown(
  error: unknown,
  options?: Omit<ReportAppErrorInput, 'message' | 'name' | 'stack'>,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const name = error instanceof Error ? error.name : undefined;
  reportAppError({
    message: message || 'Unknown error',
    name,
    stack,
    level: options?.level ?? 'error',
    fatal: options?.fatal,
    important: options?.important,
    screen: options?.screen,
    userId: options?.userId,
    context: options?.context,
  });
}

/** Operational issues (API 4xx/5xx, cart sync, etc.) — reserved for future telemetry; no-op today. */
export function reportOperationalFailure(
  _message: string,
  _context?: Record<string, unknown>,
  _level: 'error' | 'warn' = 'error',
): void {}
