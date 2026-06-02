import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { flushRenderTraceSummary, isRenderTraceEnabled } from '@/lib/render-trace';

/** Logs `[RENDER SUMMARY]` on route changes when render tracing is enabled. */
export function RenderTraceSync() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isRenderTraceEnabled()) return;
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    if (prev == null) return;
    flushRenderTraceSummary(`${prev} → ${pathname}`);
  }, [pathname]);

  return null;
}
