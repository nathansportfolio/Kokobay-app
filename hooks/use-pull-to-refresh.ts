import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { hapticSuccess } from '@/utils/haptics';
import { refreshAppData } from '@/utils/refresh-app-data';
import { withMinDisplay } from '@/utils/with-min-display';

type RefetchResult = { isError?: boolean } | void;

/** Wraps a React Query `refetch` for pull-to-refresh (haptic on success). */
export function useQueryPullToRefresh(refetch: () => Promise<RefetchResult>) {
  const onRefresh = useCallback(() => {
    void refetch().then((result) => {
      if (!result?.isError) {
        hapticSuccess();
      }
    });
  }, [refetch]);

  return { onRefresh };
}

/** Pull-to-refresh for screens without their own query — refreshes shared catalog caches. */
export function useGlobalPullToRefresh(extra?: () => Promise<void>) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    void (async () => {
      setRefreshing(true);
      try {
        await withMinDisplay(async () => {
          await refreshAppData(queryClient);
          if (extra) {
            await extra();
          }
        });
        hapticSuccess();
      } finally {
        setRefreshing(false);
      }
    })();
  }, [queryClient, extra]);

  return { refreshing, onRefresh };
}
