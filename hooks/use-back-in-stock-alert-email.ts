import { useEffect, useState } from 'react';

import {
  getLocalBackInStockEmailForVariant,
} from '@/store/back-in-stock-persist';

/** Account email when signed in; otherwise the best local guest email for this variant. */
export function useBackInStockAlertEmail(input: {
  variantId: string | undefined;
  customerEmail: string | undefined;
}) {
  const [guestEmail, setGuestEmail] = useState<string | undefined>();

  useEffect(() => {
    if (input.customerEmail?.trim()) {
      setGuestEmail(undefined);
      return;
    }
    if (!input.variantId) {
      setGuestEmail(undefined);
      return;
    }

    let cancelled = false;
    void (async () => {
      const forVariant = await getLocalBackInStockEmailForVariant(input.variantId!);
      if (!cancelled) setGuestEmail(forVariant ?? undefined);
    })();

    return () => {
      cancelled = true;
    };
  }, [input.customerEmail, input.variantId]);

  const accountEmail = input.customerEmail?.trim();
  return accountEmail || guestEmail;
}
