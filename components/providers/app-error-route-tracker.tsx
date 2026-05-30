import { usePathname, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { registerAppErrorScreenReader } from '@/lib/app-error-context';

/** Keeps current route on the error-reporting context for `/api/app/error-log`. */
export function AppErrorRouteTracker() {
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    registerAppErrorScreenReader(() => {
      const seg = segments.length ? segments.join('/') : '';
      return pathname || (seg ? `/${seg}` : '/');
    });
  }, [pathname, segments]);

  return null;
}
