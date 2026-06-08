export type RefreshCustomerSessionResult =
  | {
      status: 'ok';
      token: string;
      data: Record<string, unknown>;
      sessionCookie: string | null;
    }
  | { status: 'session_invalid' }
  | { status: 'session_unknown'; reason: 'network' | 'timeout' | 'server' | 'offline' };

type RefreshPostOutcome =
  | {
      kind: 'success';
      token: string;
      data: Record<string, unknown>;
      sessionCookie: string | null;
    }
  | { kind: 'session_invalid' }
  | { kind: 'session_unknown'; reason: 'network' | 'timeout' | 'server' | 'offline' };

export type RefreshCustomerSessionDeps = {
  resolveExistingToken: (override?: string) => Promise<string | null>;
  postRefresh: (existing: string) => Promise<RefreshPostOutcome>;
  commitRefreshedToken: (token: string) => Promise<void>;
  commitInvalidSession: () => Promise<void>;
  runSerialized: <T>(fn: () => Promise<T>) => Promise<T>;
};

/** Shared refresh orchestration for API interceptor and cold-start restore. */
export async function refreshCustomerSessionWithDeps(
  deps: RefreshCustomerSessionDeps,
  existingToken?: string,
): Promise<RefreshCustomerSessionResult> {
  const existing = existingToken?.trim() || (await deps.resolveExistingToken(existingToken));
  if (!existing) {
    return { status: 'session_invalid' };
  }

  return deps.runSerialized(async () => {
    const outcome = await deps.postRefresh(existing);

    if (outcome.kind === 'session_invalid') {
      await deps.commitInvalidSession();
      return { status: 'session_invalid' };
    }

    if (outcome.kind === 'session_unknown') {
      return { status: 'session_unknown', reason: outcome.reason };
    }

    await deps.commitRefreshedToken(outcome.token);
    return {
      status: 'ok',
      token: outcome.token,
      data: outcome.data,
      sessionCookie: outcome.sessionCookie,
    };
  });
}
