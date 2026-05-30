import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getGtmConfig, isGtmLiveConfigured } from '@/lib/gtm/config';
import { gtmLiveReceiver } from '@/lib/gtm/receivers/gtm-receiver';
import { mockGtmReceiver } from '@/lib/gtm/receivers/mock-receiver';
import type { GtmDataLayerEvent } from '@/lib/gtm/types';

function appMeta() {
  return {
    app_name: Constants.expoConfig?.name ?? 'Koko Bay',
    app_version:
      Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? undefined,
    platform: Platform.OS,
    environment: __DEV__ ? 'development' : 'production',
  };
}

function enrichEvent(event: GtmDataLayerEvent): GtmDataLayerEvent {
  return {
    ...appMeta(),
    ...event,
    ...(event.ecommerce === undefined ? {} : { ecommerce: event.ecommerce }),
  };
}

export function pushToDataLayer(event: GtmDataLayerEvent): void {
  const payload = enrichEvent(event);
  const { debug } = getGtmConfig();

  if (!isGtmLiveConfigured()) {
    mockGtmReceiver.push(payload);
    return;
  }

  gtmLiveReceiver.push(payload);
  if (debug) {
    mockGtmReceiver.push(payload);
  }
}
