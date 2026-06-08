import { bootstrapManager, isBootstrapServicesReady } from '@/src/core/bootstrap';
import type { AuthUser } from '@/types/auth';

import { pushEngine } from './push-engine';

type AuthStoreSnapshot = {
  user: AuthUser | null;
};

type AuthStoreLike = {
  getState: () => AuthStoreSnapshot;
  subscribe: (listener: (state: AuthStoreSnapshot, prev: AuthStoreSnapshot) => void) => () => void;
};

/**
 * Push + marketing SDK workflow — single subscription, no screen-level useEffects.
 * Call once at app startup from `AppProviders`.
 */
export function startPushEngine(useAuthStore: AuthStoreLike): () => void {
  const onServicesReady = () => {
    pushEngine.onServicesReady();
    pushEngine.syncCurrentAuth(useAuthStore.getState().user);
  };

  if (isBootstrapServicesReady(bootstrapManager.getPhase())) {
    onServicesReady();
  }

  const unsubscribeBootstrap = bootstrapManager.subscribe((phase) => {
    if (phase === 'complete') {
      onServicesReady();
    }
  });

  let prevUser = useAuthStore.getState().user;

  const unsubscribeAuth = useAuthStore.subscribe((state) => {
    const previousUser = prevUser;
    prevUser = state.user;
    pushEngine.onAuthChange(state.user, previousUser);
  });

  return () => {
    unsubscribeBootstrap();
    unsubscribeAuth();
  };
}
