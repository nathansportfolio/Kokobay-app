import { useMemo } from 'react';

import { authViewFromState } from '@/src/core/auth/types';
import type { AuthView } from '@/src/core/auth/types';
import { useAuthStore } from '@/store/auth-session';

/** Screen hook — `status` + `user` only. No tokens. */
export function useAuth(): AuthView {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const errorMessage = useAuthStore((s) => s.errorMessage);

  return useMemo(
    () => authViewFromState({ status, user, errorMessage }),
    [status, user, errorMessage],
  );
}
