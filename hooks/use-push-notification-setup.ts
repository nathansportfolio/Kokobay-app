import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { isExpoGoClient } from '@/lib/expo-notifications-safe';
import {
  addPushTokenRefreshListener,
  registerPushNotifications,
  setPushNavigationReady,
  setupPushNotificationListeners,
  type PushNotificationNavigate,
} from '@/lib/pushNotifications';
import { useAuthStore } from '@/store';

/**
 * Root-level hook: notification listeners + auto-register after auth hydrate.
 * Requests OS permission on launch (guest or signed in). Must run inside root `_layout`.
 * No-ops in Expo Go — push requires a development or production build.
 */
export function usePushNotificationSetup(navigationReady = true): void {
  const router = useRouter();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const user = useAuthStore((s) => s.user);
  const email = user?.email;
  const listenersAttached = useRef(false);
  const previousEmailRef = useRef<string | undefined>(undefined);
  const isExpoGo = isExpoGoClient();

  useEffect(() => {
    if (isExpoGo) return;
    if (listenersAttached.current) return;
    listenersAttached.current = true;

    const navigate: PushNotificationNavigate = (href: Href, options) => {
      if (options?.replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    };

    const removeListeners = setupPushNotificationListeners(navigate);
    return () => {
      listenersAttached.current = false;
      removeListeners();
    };
  }, [isExpoGo, router]);

  useEffect(() => {
    setPushNavigationReady(navigationReady);
    return () => setPushNavigationReady(false);
  }, [navigationReady]);

  useEffect(() => {
    if (isExpoGo) return;
    if (!hasHydrated) return;

    const previousEmail = previousEmailRef.current;
    previousEmailRef.current = email;

    // Sign-out clears session first; performSignOut re-registers push after unregister.
    if (previousEmail?.trim() && !email?.trim()) {
      const removeTokenListener = addPushTokenRefreshListener(email);
      return () => removeTokenListener();
    }

    void registerPushNotifications(email);
    const removeTokenListener = addPushTokenRefreshListener(email);
    return () => removeTokenListener();
  }, [email, hasHydrated, isExpoGo]);
}
