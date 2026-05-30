import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { reportAppErrorFromUnknown } from '@/lib/appErrorLog';

let client: QueryClient | null = null;

export function getQueryClient() {
  if (!client) {
    client = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          reportAppErrorFromUnknown(error, {
            context: {
              source: 'react_query',
              queryKey: query.queryKey,
              queryHash: query.queryHash,
              status: query.state.status,
            },
          });
        },
      }),
      mutationCache: new MutationCache({
        onError: (error, _variables, _context, mutation) => {
          reportAppErrorFromUnknown(error, {
            context: {
              source: 'react_query_mutation',
              mutationKey: mutation.options.mutationKey ?? null,
              status: mutation.state.status,
            },
          });
        },
      }),
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
  }
  return client;
}
