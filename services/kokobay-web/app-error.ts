import { legacyApiGetOptional } from '@/src/core/api';

import { isKokobayApiConfigured, kokobayApiEnvDebug } from './api-config';

export type AppErrorBannerPayload = {
  active: boolean;
  message: string;
};

/** `GET /api/app-error` — Shopify `app_error` metaobject (not app_content). */
export async function fetchAppErrorBanner(
  init?: { signal?: AbortSignal },
): Promise<AppErrorBannerPayload | null> {
  const incidentEnabled = process.env.EXPO_PUBLIC_INCIDENT_BANNER_ENABLED === 'true';

  if (!isKokobayApiConfigured()) {
    if (__DEV__) {
      console.log('[INCIDENT_BANNER]', { visible: false, reason: 'api_not_configured', incidentEnabled });
    }
    return null;
  }

  const json = await legacyApiGetOptional('/api/app-error', {
    auth: 'none',
    marketQuery: false,
    signal: init?.signal,
    retries: 0,
    coalesce: false,
  });

  if (init?.signal?.aborted) {
    if (__DEV__) {
      console.log('[INCIDENT_BANNER]', { visible: false, reason: 'aborted', incidentEnabled });
    }
    return null;
  }

  if (!json) {
    if (__DEV__) {
      console.log('[INCIDENT_BANNER]', {
        baseUrl: kokobayApiEnvDebug().baseUrl,
        visible: false,
        reason: 'no_response',
        incidentEnabled,
      });
    }
    return null;
  }

  const active = json.active === true;
  const message = typeof json.message === 'string' ? json.message.trim() : '';
  const visible = incidentEnabled && active && Boolean(message);

  if (__DEV__) {
    console.log('[INCIDENT_BANNER]', {
      baseUrl: kokobayApiEnvDebug().baseUrl,
      incidentEnabled,
      rawActive: active,
      rawMessage: json.message ?? null,
      rawError: typeof json.error === 'string' ? json.error : null,
      visible,
      message: message || null,
      ...(incidentEnabled ? {} : { note: 'Set EXPO_PUBLIC_INCIDENT_BANNER_ENABLED=true to show strip' }),
    });
  }

  if (!active || !message) return null;
  return { active: true, message };
}
