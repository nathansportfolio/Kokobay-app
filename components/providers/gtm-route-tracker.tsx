import { usePathname, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useBootstrapPhase } from '@/hooks/use-bootstrap-phase';
import { trackPageView } from '@/lib/gtm';

const SCREEN_TITLES: Record<string, string> = {
  index: 'Home',
  categories: 'Collections',
  cart: 'Bag',
  wishlist: 'Wishlist',
  account: 'Account',
  search: 'Search',
  checkout: 'Checkout',
  login: 'Sign in',
  register: 'Create account',
  'forgot-password': 'Forgot password',
  'app-settings': 'App settings',
};

function titleFromSegments(segments: string[]): string | undefined {
  const leaf = segments[segments.length - 1];
  if (!leaf) return undefined;
  if (SCREEN_TITLES[leaf]) return SCREEN_TITLES[leaf];
  if (leaf === '[handle]') {
    const parent = segments[segments.length - 2];
    if (parent === 'product') return 'Product';
    if (parent === 'collection') return 'Collection';
  }
  if (leaf === '[slug]') return 'Content';
  if (leaf === '[orderId]') return 'Order';
  return undefined;
}

/** Fires `page_view` on route changes (GTM dataLayer). */
export function GtmRouteTracker() {
  const pathname = usePathname();
  const segments = useSegments();
  const lastTracked = useRef<string | null>(null);
  const { servicesReady } = useBootstrapPhase();

  useEffect(() => {
    if (!servicesReady) return;

    const pagePath = pathname || (segments.length ? `/${segments.join('/')}` : '/');
    if (!pagePath || lastTracked.current === pagePath) return;
    lastTracked.current = pagePath;

    trackPageView({
      pagePath,
      pageTitle: titleFromSegments([...segments]),
    });
  }, [pathname, segments, servicesReady]);

  return null;
}
