import { Easing, type WithSpringConfig } from 'react-native-reanimated';

/** Drawer open/close — calm ease-out (~400ms), luxury pacing */
export const LUXURY_DRAWER_TIMING = {
  duration: 400,
  easing: Easing.out(Easing.cubic),
} as const;

/** Editorial drawer — soft settle, no bounce (legacy / other UI) */
export const LUXURY_DRAWER_SPRING: WithSpringConfig = {
  damping: 36,
  stiffness: 178,
  mass: 0.92,
};

export const LUXURY_PINCH_SPRING: WithSpringConfig = {
  damping: 28,
  stiffness: 220,
  mass: 0.85,
};

/** PDP carousel programmatic scroll */
export const PDP_CAROUSEL_SCROLL_MS = 520;

/** expo-image cross-dissolve when gallery URI updates */
export const PDP_IMAGE_TRANSITION = {
  duration: 340,
  timing: 'ease-in-out' as const,
  effect: 'cross-dissolve' as const,
};

/** Home tab — soft reveal when returning later in the session (skipped on cold start). */
export const LUXURY_HOME_ENTRANCE = {
  duration: 250,
  delay: 0,
  easing: Easing.out(Easing.cubic),
} as const;
