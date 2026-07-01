import { useEffect, useState } from 'react';

import {
  getLocalBackInStockEmailForVariant,
  getMostRecentLocalBackInStockEmail,
} from '@/store/back-in-stock-persist';

/** Best email to prefill in back-in-stock forms (variant-specific, then recent guest email). */
export function useBackInStockPrefillEmail(input: {
  variantId: string | undefined;
  customerEmail: string | undefined;
  enabled: boolean;
}) {
  const [prefillEmail, setPrefillEmail] = useState('');

  useEffect(() => {
    if (!input.enabled) {
      setPrefillEmail('');
      return;
    }

    const accountEmail = input.customerEmail?.trim();
    if (accountEmail) {
      setPrefillEmail(accountEmail);
      return;
    }

    if (!input.variantId) {
      setPrefillEmail('');
      return;
    }

    let cancelled = false;
    void (async () => {
      const saved =
        (await getLocalBackInStockEmailForVariant(input.variantId!)) ??
        (await getMostRecentLocalBackInStockEmail()) ??
        '';
      if (!cancelled) setPrefillEmail(saved);
    })();

    return () => {
      cancelled = true;
    };
  }, [input.customerEmail, input.enabled, input.variantId]);

  return prefillEmail;
}
