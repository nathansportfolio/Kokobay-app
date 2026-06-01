import type { GtmDataLayerEvent, GtmReceiver } from '@/lib/gtm/types';

const MAX_BUFFER = 200;

const eventBuffer: GtmDataLayerEvent[] = [];

function bufferEvent(event: GtmDataLayerEvent): void {
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER) {
    eventBuffer.splice(0, eventBuffer.length - MAX_BUFFER);
  }
}

export const mockGtmReceiver: GtmReceiver = {
  name: 'mock',
  push(event) {
    bufferEvent(event);
  },
};

/** Dev helper — recent mock events (newest last). */
export function getMockGtmEvents(): readonly GtmDataLayerEvent[] {
  return eventBuffer;
}

export function clearMockGtmEvents(): void {
  eventBuffer.length = 0;
}
