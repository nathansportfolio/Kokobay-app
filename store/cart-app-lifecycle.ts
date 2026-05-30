/** App foreground/background hooks for cart sync — injectable for tests. */

export type AppLifecycle = {
  isActive: () => boolean;
  onStateChange: (listener: (active: boolean) => void) => () => void;
  deferAfterInteractions: (fn: () => void) => void;
};

/** Node tests — always foreground, no resume side effects. */
export const alwaysActiveAppLifecycle: AppLifecycle = {
  isActive: () => true,
  onStateChange: () => () => {},
  deferAfterInteractions: (fn) => {
    fn();
  },
};
