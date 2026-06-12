import type { Href, Router } from 'expo-router';
import { Keyboard } from 'react-native';

import { yieldForUiPaint } from '@/utils/yield-for-ui-paint';

/** Close the full-screen search modal opened via `router.push('/search-overlay')`. */
export function closeSearchOverlay(router: Pick<Router, 'back' | 'canGoBack' | 'replace'>): void {
  Keyboard.dismiss();
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/' as Href);
}

/** Pop the overlay, wait for the dismiss animation, then push the destination route. */
export async function leaveSearchOverlayFor(
  router: Pick<Router, 'back' | 'canGoBack' | 'push'>,
  href: Href,
): Promise<void> {
  Keyboard.dismiss();
  if (router.canGoBack()) {
    router.back();
  }
  await yieldForUiPaint();
  router.push(href);
}
