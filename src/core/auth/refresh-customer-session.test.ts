import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  refreshCustomerSessionWithDeps,
  type RefreshCustomerSessionDeps,
} from './refresh-customer-session-runner';

const CUSTOMER = {
  id: 'cust-1',
  email: 'shopper@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
};

type TestHarness = RefreshCustomerSessionDeps & {
  refreshedTokens: string[];
  invalidations: number;
  refreshCalls: number;
  serializedRuns: number;
  storedToken: string;
  loggedOut: boolean;
};

function createDeps(overrides: Partial<RefreshCustomerSessionDeps> = {}): TestHarness {
  const harness: TestHarness = {
    refreshedTokens: [],
    invalidations: 0,
    refreshCalls: 0,
    serializedRuns: 0,
    storedToken: 'expired-token-v1',
    loggedOut: false,
    resolveExistingToken: async (override) => override?.trim() || harness.storedToken,
    postRefresh: async () => {
      harness.refreshCalls += 1;
      if (harness.loggedOut) {
        return { kind: 'session_invalid' };
      }
      return {
        kind: 'success',
        token: 'refreshed-token-v2',
        data: { ok: true, customer: CUSTOMER, sessionToken: 'refreshed-token-v2' },
        sessionCookie: 'refreshed-token-v2',
      };
    },
    commitRefreshedToken: async (token) => {
      harness.refreshedTokens.push(token);
      harness.storedToken = token;
    },
    commitInvalidSession: async () => {
      harness.invalidations += 1;
      harness.storedToken = '';
    },
    runSerialized: async (fn) => {
      harness.serializedRuns += 1;
      return fn();
    },
  };

  return Object.assign(harness, overrides);
}

describe('refreshCustomerSessionWithDeps', () => {
  it('refreshes an expired token during an active session', async () => {
    const deps = createDeps();

    const result = await refreshCustomerSessionWithDeps(deps, 'expired-token-v1');

    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.token, 'refreshed-token-v2');
      assert.equal(result.data.ok, true);
    }
    assert.deepEqual(deps.refreshedTokens, ['refreshed-token-v2']);
    assert.equal(deps.refreshCalls, 1);
    assert.equal(deps.serializedRuns, 1);
    assert.equal(deps.invalidations, 0);
  });

  it('refreshes an expired token during cold-start restore', async () => {
    const deps = createDeps({
      resolveExistingToken: async () => 'persisted-cold-start-token',
    });

    const result = await refreshCustomerSessionWithDeps(deps);

    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.token, 'refreshed-token-v2');
      assert.equal(result.sessionCookie, 'refreshed-token-v2');
    }
    assert.deepEqual(deps.refreshedTokens, ['refreshed-token-v2']);
  });

  it('marks the session invalid when refresh fails', async () => {
    const deps = createDeps({
      postRefresh: async () => ({ kind: 'session_invalid' }),
    });

    const result = await refreshCustomerSessionWithDeps(deps, 'expired-token-v1');

    assert.equal(result.status, 'session_invalid');
    assert.equal(deps.invalidations, 1);
    assert.equal(deps.refreshedTokens.length, 0);
  });

  it('returns session_unknown on transient refresh failures without invalidating', async () => {
    const deps = createDeps({
      postRefresh: async () => ({ kind: 'session_unknown', reason: 'network' }),
    });

    const result = await refreshCustomerSessionWithDeps(deps, 'expired-token-v1');

    assert.equal(result.status, 'session_unknown');
    if (result.status === 'session_unknown') {
      assert.equal(result.reason, 'network');
    }
    assert.equal(deps.invalidations, 0);
    assert.equal(deps.refreshedTokens.length, 0);
  });

  it('supports logout after a successful refresh', async () => {
    const deps = createDeps();

    const refreshed = await refreshCustomerSessionWithDeps(deps, 'expired-token-v1');
    assert.equal(refreshed.status, 'ok');

    deps.loggedOut = true;
    const afterLogout = await refreshCustomerSessionWithDeps(deps, deps.storedToken);

    assert.equal(afterLogout.status, 'session_invalid');
    assert.equal(deps.invalidations, 1);
    assert.deepEqual(deps.refreshedTokens, ['refreshed-token-v2']);
  });

  it('serializes concurrent refresh attempts through runSerialized', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let serializedRuns = 0;
    let chain = Promise.resolve();

    const deps = createDeps({
      postRefresh: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return {
          kind: 'success',
          token: 'refreshed-token-v2',
          data: { ok: true, customer: CUSTOMER },
          sessionCookie: 'refreshed-token-v2',
        };
      },
      runSerialized: async (fn) => {
        serializedRuns += 1;
        const run = chain.then(fn);
        chain = run.then(() => undefined);
        return run;
      },
    });

    await Promise.all([
      refreshCustomerSessionWithDeps(deps, 'expired-token-v1'),
      refreshCustomerSessionWithDeps(deps, 'expired-token-v1'),
    ]);

    assert.equal(maxInFlight, 1);
    assert.equal(serializedRuns, 2);
  });
});
