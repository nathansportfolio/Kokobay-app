import { getGtmConfig } from '@/lib/gtm/config';
import type { GtmDataLayerEvent, GtmReceiver } from '@/lib/gtm/types';

const SEND_TIMEOUT_MS = 8_000;

function buildPayload(event: GtmDataLayerEvent, containerId: string) {
  return {
    client_id: containerId,
    timestamp_micros: Date.now() * 1000,
    events: [
      {
        name: event.event,
        params: {
          ...event,
          container_id: containerId,
        },
      },
    ],
  };
}

async function postEvent(endpoint: string, containerId: string, event: GtmDataLayerEvent): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(event, containerId)),
      signal: controller.signal,
    });
  } catch {
    // Analytics must never break the app — swallow network errors until creds are verified.
  } finally {
    clearTimeout(timer);
  }
}

export const gtmLiveReceiver: GtmReceiver = {
  name: 'gtm',
  push(event) {
    const { containerId, endpoint } = getGtmConfig();
    if (!containerId || !endpoint) return;
    void postEvent(endpoint, containerId, event);
  },
};
