import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { pushEngine } from '@/src/core/push';

type PushNavigationBridgeProps = {
  navigationReady: boolean;
};

/**
 * Wires Expo Router into the push engine for notification taps.
 * No registration or auth side effects — those live in `startPushEngine`.
 */
export function PushNavigationBridge({ navigationReady }: PushNavigationBridgeProps) {
  const router = useRouter();

  useEffect(() => {
    return pushEngine.attachNotificationListeners((href: Href, options) => {
      if (options?.replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    });
  }, [router]);

  useEffect(() => {
    pushEngine.setNavigationReady(navigationReady);
    return () => pushEngine.setNavigationReady(false);
  }, [navigationReady]);

  return null;
}
