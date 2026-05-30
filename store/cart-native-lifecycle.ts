import { AppState, type AppStateStatus } from 'react-native';

import type { AppLifecycle } from './cart-app-lifecycle';

export const nativeAppLifecycle: AppLifecycle = {
  isActive: () => AppState.currentState === 'active',
  onStateChange: (listener) => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      listener(state === 'active');
    });
    return () => sub.remove();
  },
  deferAfterInteractions: (fn) => {
    // Prefer a short timer over InteractionManager — on foreground resume the interaction
    // queue can stay busy while native scroll still works, delaying JS Pressables.
    requestAnimationFrame(() => {
      setTimeout(fn, 0);
    });
  },
};
