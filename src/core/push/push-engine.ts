import type { Href } from 'expo-router';

import { isExpoGoClient } from '@/lib/expo-notifications-safe';
import {
  identifyKlaviyoUser,
  initializeKlaviyo,
  resetKlaviyoProfile,
  updateKlaviyoProfileProperties,
} from '@/lib/klaviyo/client';
import {
  addPushTokenRefreshListener,
  pausePushRegistrationForSignOut,
  registerPushNotifications,
  resumePushRegistrationAfterSignOut,
  setPushNavigationReady,
  setupPushNotificationListeners,
  unregisterPushNotifications,
  type PushNotificationNavigate,
} from '@/lib/pushNotifications';
import { logSignOutPerf } from '@/lib/sign-out-perf';
import { setFirebaseCrashlyticsUserId } from '@/src/lib/firebase-crashlytics';
import type { AuthUser } from '@/types/auth';

type AuthUserSnapshot = Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName'> | null;

let listenersCleanup: (() => void) | null = null;
let tokenRefreshCleanup: (() => void) | null = null;
let servicesReady = false;
let previousEmail: string | undefined;

function isExpoGo(): boolean {
  return isExpoGoClient();
}

function syncCrashlyticsUser(user: AuthUserSnapshot): void {
  void setFirebaseCrashlyticsUserId(user?.id ?? user?.email);
}

function syncKlaviyoUser(user: AuthUserSnapshot): void {
  if (!user) {
    resetKlaviyoProfile();
    return;
  }
  identifyKlaviyoUser(user);
}

function syncKlaviyoProfilePatch(user: AuthUser, prev: AuthUser): void {
  if (
    user.firstName !== prev.firstName ||
    user.lastName !== prev.lastName ||
    user.email !== prev.email
  ) {
    updateKlaviyoProfileProperties(user);
  }
}

function replaceTokenRefreshListener(email?: string): void {
  tokenRefreshCleanup?.();
  tokenRefreshCleanup = addPushTokenRefreshListener(email);
}

function syncPushRegistration(email?: string): void {
  if (isExpoGo() || !servicesReady) return;

  const previous = previousEmail;
  previousEmail = email;

  if (previous?.trim() && !email?.trim()) {
    replaceTokenRefreshListener(email);
    return;
  }

  void registerPushNotifications(email, 'push_engine');
  replaceTokenRefreshListener(email);
}

export const pushEngine = {
  onServicesReady(): void {
    if (servicesReady) return;
    servicesReady = true;
    initializeKlaviyo();
  },

  onAuthChange(user: AuthUserSnapshot, prevUser: AuthUserSnapshot): void {
    if (!servicesReady) return;

    syncCrashlyticsUser(user);

    if (user !== prevUser) {
      syncKlaviyoUser(user);
    } else if (user && prevUser) {
      syncKlaviyoProfilePatch(user, prevUser);
    }

    const email = user?.email;
    if (email !== prevUser?.email) {
      syncPushRegistration(email);
    }
  },

  syncCurrentAuth(user: AuthUserSnapshot): void {
    if (!servicesReady) return;
    syncCrashlyticsUser(user);
    syncKlaviyoUser(user);
    syncPushRegistration(user?.email);
  },

  setNavigationReady(ready: boolean): void {
    setPushNavigationReady(ready);
  },

  attachNotificationListeners(navigate: PushNotificationNavigate): () => void {
    if (isExpoGo()) return () => {};
    if (listenersCleanup) return listenersCleanup;

    listenersCleanup = setupPushNotificationListeners(
      (href: Href, options) => navigate(href, options),
    );

    return () => {
      listenersCleanup?.();
      listenersCleanup = null;
    };
  },

  async runSignOutBackground(email: string | undefined): Promise<void> {
    pausePushRegistrationForSignOut();

    try {
      const pushStart = performance.now();
      await unregisterPushNotifications(email).catch(() => {});
      logSignOutPerf('push_unregister_complete', {
        ms: Math.round(performance.now() - pushStart),
      });
    } finally {
      resumePushRegistrationAfterSignOut();
      const guestPushStart = performance.now();
      const guestPush = await registerPushNotifications(undefined, 'sign_out_guest');
      logSignOutPerf('push_guest_register_complete', {
        ms: Math.round(performance.now() - guestPushStart),
        skipped: Boolean(guestPush.ok && guestPush.skipped),
      });
      previousEmail = undefined;
      replaceTokenRefreshListener(undefined);
    }
  },

  resetForTests(): void {
    servicesReady = false;
    previousEmail = undefined;
    tokenRefreshCleanup?.();
    tokenRefreshCleanup = null;
    listenersCleanup?.();
    listenersCleanup = null;
  },
};
