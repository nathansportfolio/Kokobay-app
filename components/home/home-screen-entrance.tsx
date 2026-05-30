import { type ReactNode, useRef } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LUXURY_HOME_ENTRANCE } from '@/constants/luxury-motion';
import { isAppLaunchRevealComplete } from '@/lib/app-launch';

let homeEntrancePlayedThisSession = false;

function claimHomeEntrance(): boolean {
  if (homeEntrancePlayedThisSession) return false;
  homeEntrancePlayedThisSession = true;
  return true;
}

const firstOpenEntering = FadeIn.duration(LUXURY_HOME_ENTRANCE.duration)
  .delay(LUXURY_HOME_ENTRANCE.delay)
  .easing(LUXURY_HOME_ENTRANCE.easing);

type HomeScreenEntranceProps = {
  children: ReactNode;
};

/** Soft fade when home content mounts later in the session (cold start uses splash fade only). */
export function HomeScreenEntrance({ children }: HomeScreenEntranceProps) {
  const shouldAnimate = useRef(
    !isAppLaunchRevealComplete() && claimHomeEntrance(),
  ).current;

  return (
    <Animated.View
      entering={shouldAnimate ? firstOpenEntering : undefined}
      className="flex-1 bg-canvas">
      {children}
    </Animated.View>
  );
}
