import { getQueryClient } from '@/hooks/use-query-client';

/** User-scoped React Query prefixes torn down on sign-out (wishlist/catalog stay active). */
const USER_QUERY_ROOTS = [['account']] as const;

/**
 * Stop in-flight user queries and drop cached account data when sign-out begins.
 * Catalog, wishlist, product, and search queries are intentionally preserved.
 */
export function teardownUserQueriesOnSignOut(): void {
  const queryClient = getQueryClient();

  for (const queryKey of USER_QUERY_ROOTS) {
    void queryClient.cancelQueries({ queryKey });
    queryClient.removeQueries({ queryKey });
  }
}
