import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyHttpRestoreResponse,
  isSessionInvalidCode,
} from './customer-auth-shared.js';

describe('isSessionInvalidCode', () => {
  it('treats explicit server session codes as invalid', () => {
    assert.equal(isSessionInvalidCode('unauthorized'), true);
    assert.equal(isSessionInvalidCode('invalid_session'), true);
    assert.equal(isSessionInvalidCode('session_expired'), true);
    assert.equal(isSessionInvalidCode('expired'), true);
  });

  it('does not treat login credential errors as session invalid', () => {
    assert.equal(isSessionInvalidCode('invalid_credentials'), false);
    assert.equal(isSessionInvalidCode(undefined), false);
  });
});

describe('classifyHttpRestoreResponse', () => {
  it('maps 401 to session_invalid', () => {
    const result = classifyHttpRestoreResponse(401, { ok: false, code: 'unauthorized' }, false);
    assert.equal(result?.kind, 'session_invalid');
  });

  it('maps 5xx to session_unknown', () => {
    const result = classifyHttpRestoreResponse(503, null, true);
    assert.equal(result?.kind, 'session_unknown');
    if (result?.kind === 'session_unknown') {
      assert.equal(result.reason, 'server');
    }
  });

  it('maps ambiguous 4xx to session_unknown', () => {
    const result = classifyHttpRestoreResponse(429, { ok: false, code: 'rate_limited' }, false);
    assert.equal(result?.kind, 'session_unknown');
  });

  it('returns null for successful payload', () => {
    const result = classifyHttpRestoreResponse(
      200,
      { ok: true, customer: { id: '1', email: 'a@b.c', firstName: 'A', lastName: 'B' } },
      false,
    );
    assert.equal(result, null);
  });
});
