import type { QueryClient } from '@tanstack/react-query';

import { isProductCardDiffTraceEnabled } from '@/lib/product-card-storm-trace';

let installed = false;

/** Dev-only — logs `[QUERY_SUBSCRIBER_UPDATE]` when React Query cache entries update. */
export function installQuerySubscriberTrace(queryClient: QueryClient): void {
  if (!__DEV__ || !isProductCardDiffTraceEnabled() || installed) return;
  installed = true;

  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return;

    const { query } = event;
    const componentsUpdated =
      typeof query.getObserversCount === 'function'
        ? query.getObserversCount()
        : query.observers.length;

    console.log(
      `[QUERY_SUBSCRIBER_UPDATE] queryKey=${JSON.stringify(query.queryKey)} components_updated=${componentsUpdated}`,
    );
  });
}

/** Test helper — reset install guard. */
export function resetQuerySubscriberTraceForTests(): void {
  installed = false;
}
