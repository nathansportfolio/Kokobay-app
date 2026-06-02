import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { APP_ERROR_QUERY_KEY, isIncidentBannerEnabled } from '@/hooks/use-app-error-banner-content';
import { registerTrackedAppStateListener } from '@/lib/lifecycle-perf/install';
import { traceResumeHandlerSync } from '@/lib/resume-perf';

/** Refreshes Shopify incident banner when `EXPO_PUBLIC_INCIDENT_BANNER_ENABLED=true`. */
export function AppErrorBannerSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isIncidentBannerEnabled()) return;

    return registerTrackedAppStateListener('app-error-banner-sync', (state) => {
      if (state === 'active') {
        traceResumeHandlerSync('incident_error_banner.invalidate', () => {
          void queryClient.invalidateQueries({ queryKey: [...APP_ERROR_QUERY_KEY] });
        });
      }
    });
  }, [queryClient]);

  return null;
}
