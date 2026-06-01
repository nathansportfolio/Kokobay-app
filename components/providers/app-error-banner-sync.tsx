import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { APP_ERROR_QUERY_KEY, isIncidentBannerEnabled } from '@/hooks/use-app-error-banner-content';

/** Refreshes Shopify incident banner when `EXPO_PUBLIC_INCIDENT_BANNER_ENABLED=true`. */
export function AppErrorBannerSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isIncidentBannerEnabled()) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void queryClient.invalidateQueries({ queryKey: [...APP_ERROR_QUERY_KEY] });
      }
    });
    return () => sub.remove();
  }, [queryClient]);

  return null;
}
