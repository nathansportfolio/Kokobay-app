import { useAppBenefitsStore } from '@/store/app-benefits';

export function useAppBenefits() {
  const isFirstAppOrder = useAppBenefitsStore((s) => s.isFirstAppOrder);
  const appOrdersCount = useAppBenefitsStore((s) => s.appOrdersCount);
  const eligibleDiscounts = useAppBenefitsStore((s) => s.eligibleDiscounts);

  return {
    isFirstAppOrder,
    appOrdersCount,
    eligibleDiscounts,
    hasOrderedOnAppBefore:
      isFirstAppOrder === null && appOrdersCount === null
        ? null
        : isFirstAppOrder === false || (appOrdersCount ?? 0) > 0,
  };
}
