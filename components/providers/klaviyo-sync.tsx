import { useEffect } from 'react';

import {
  identifyKlaviyoUser,
  initializeKlaviyo,
  resetKlaviyoProfile,
  updateKlaviyoProfileProperties,
} from '@/lib/klaviyo/client';
import { useAuthStore } from '@/store/auth-session';

/**
 * Keeps Klaviyo profile in sync with auth.
 * Dual push: Expo token → `/api/push/register`; native APNs/FCM → `Klaviyo.setPushToken`.
 */
export function KlaviyoSync() {
  useEffect(() => {
    initializeKlaviyo();
  }, []);

  useEffect(() => {
    const sync = () => {
      const user = useAuthStore.getState().user;
      if (!user) {
        resetKlaviyoProfile();
        return;
      }
      identifyKlaviyoUser(user);
    };

    sync();
    return useAuthStore.subscribe((state, prev) => {
      if (state.user === prev.user) {
        if (
          state.user &&
          (state.user.firstName !== prev.user?.firstName ||
            state.user.lastName !== prev.user?.lastName ||
            state.user.email !== prev.user?.email)
        ) {
          updateKlaviyoProfileProperties(state.user);
        }
        return;
      }
      sync();
    });
  }, []);

  return null;
}
