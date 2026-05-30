import type { GtmDataLayerEvent, GtmReceiver } from '@/lib/gtm/types';

const LOG_PREFIX = '[GTM mock]';
const MAX_BUFFER = 200;

const eventBuffer: GtmDataLayerEvent[] = [];

function logEvent(event: GtmDataLayerEvent): void {
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER) {
    eventBuffer.splice(0, eventBuffer.length - MAX_BUFFER);
  }

  if (__DEV__ || process.env.EXPO_PUBLIC_GTM_DEBUG === '1') {
    console.info(LOG_PREFIX, event.event, event);
  }
}

export const mockGtmReceiver: GtmReceiver = {
  name: 'mock',
  push(event) {
    logEvent(event);
  },
};

/** Dev helper — recent mock events (newest last). */
export function getMockGtmEvents(): readonly GtmDataLayerEvent[] {
  return eventBuffer;
}

export function clearMockGtmEvents(): void {
  eventBuffer.length = 0;
}
