import { useAppBenefitsQuery } from '@/hooks/use-app-benefits-query';

export function useAppBenefits() {
  const query = useAppBenefitsQuery();
  const isFirstAppOrder = query.data?.isFirstAppOrder ?? null;
  const appOrdersCount = query.data?.appOrdersCount ?? null;
  const eligibleDiscounts = query.data?.eligibleDiscounts ?? [];

  return {
    isFirstAppOrder,
    appOrdersCount,
    eligibleDiscounts,
    isLoading: query.isPending,
    hasOrderedOnAppBefore:
      isFirstAppOrder === null && appOrdersCount === null
        ? null
        : isFirstAppOrder === false || (appOrdersCount ?? 0) > 0,
  };
}
