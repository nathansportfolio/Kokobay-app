import { useQuery } from '@tanstack/react-query';

import { accountQueryKeys } from '@/src/core/query/query-keys';
import {
  fetchCustomerAppBenefits,
  type CustomerAppBenefits,
} from '@/services/kokobay-web/app-benefits';
import { useAuthStore } from '@/store/auth-session';
import { isAuthenticatedStatus } from '@/src/core/auth/types';

const APP_BENEFITS_STALE_MS = 60_000;

/** Server state for `GET /api/customer/app-benefits` — React Query only. */
export function useAppBenefitsQuery() {
  const userId = useAuthStore((s) => s.user?.id);
  const accessToken = useAuthStore((s) => s.accessToken);
  const status = useAuthStore((s) => s.status);
  const enabled = Boolean(userId && accessToken && isAuthenticatedStatus(status));

  return useQuery<CustomerAppBenefits | null>({
    queryKey: accountQueryKeys.appBenefits(userId ?? ''),
    enabled,
    staleTime: APP_BENEFITS_STALE_MS,
    queryFn: async () => {
      const result = await fetchCustomerAppBenefits(accessToken);
      if (!result.ok) return null;
      return result.benefits;
    },
  });
}
