import { getQueryClient } from '@/hooks/use-query-client';

/**
 * User-scoped React Query prefixes cleared on auth change.
 * Includes orders, app-benefits, and future account queries.
 * Catalog, wishlist, product, and CMS queries stay active.
 */
const USER_QUERY_ROOTS = [['account']] as const;

/**
 * Stop in-flight user queries and drop cached account data on sign-out or before a new session.
 * Catalog, wishlist, product, and search queries are intentionally preserved.
 */
export function clearUserScopedQueries(): void {
  const queryClient = getQueryClient();

  for (const queryKey of USER_QUERY_ROOTS) {
    void queryClient.cancelQueries({ queryKey });
    queryClient.removeQueries({ queryKey });
  }
}

/** @deprecated Use {@link clearUserScopedQueries} */
export function teardownUserQueriesOnSignOut(): void {
  clearUserScopedQueries();
}
