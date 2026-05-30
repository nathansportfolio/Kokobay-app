import { useCallback, useEffect, useState } from 'react';

import { checkBackInStockSubscription } from '@/services/kokobay-web/back-in-stock';

export function useBackInStockSubscription(input: {
  variantId: string | undefined;
  email: string | undefined;
  customerId: string | undefined;
  sessionToken: string | undefined;
  enabled: boolean;
}) {
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    if (!input.enabled || !input.variantId) {
      setSubscribed(false);
      return false;
    }
    setChecking(true);
    try {
      const active = await checkBackInStockSubscription({
        variantId: input.variantId,
        email: input.email,
        customerId: input.customerId,
        sessionToken: input.sessionToken,
      });
      setSubscribed(active);
      return active;
    } finally {
      setChecking(false);
    }
  }, [input.customerId, input.email, input.enabled, input.sessionToken, input.variantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markSubscribed = useCallback(() => {
    setSubscribed(true);
  }, []);

  return { subscribed, checking, refresh, markSubscribed };
}
