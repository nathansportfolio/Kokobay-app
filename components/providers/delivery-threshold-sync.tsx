import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { refreshDeliveryThresholdIfStale } from '@/services/delivery-threshold';

/** Refreshes delivery threshold when cache expires after foreground resume (startup load is in app launch). */
export function DeliveryThresholdSync() {
  useEffect(() => {
    let prevState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && prevState !== 'active') {
        void refreshDeliveryThresholdIfStale();
      }
      prevState = next;
    });

    return () => subscription.remove();
  }, []);

  return null;
}
