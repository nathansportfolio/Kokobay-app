import type { AppLifecycle } from '@/store/cart-app-lifecycle';

export const nativeAppLifecycle: AppLifecycle = {
  isActive: () => true,
  onStateChange: () => () => {},
  deferAfterInteractions: (fn) => {
    fn();
  },
};
