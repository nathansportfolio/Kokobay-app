import { QueryClient } from '@tanstack/react-query';

import { installQuerySubscriberTrace } from '@/lib/query-subscriber-trace';

let client: QueryClient | null = null;

export function getQueryClient() {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          /** Catalog data is safe to cache longer on-device */
          staleTime: 3 * 60_000,
          gcTime: 45 * 60_000,
          retry: 1,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        },
      },
    });
    installQuerySubscriberTrace(client);
  }
  return client;
}
