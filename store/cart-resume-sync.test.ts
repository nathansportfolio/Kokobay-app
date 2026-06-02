import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CART_RESUME_SKIP_SYNC_WITHIN_MS,
  decideCartForegroundResumeSync,
} from './cart-resume-sync';

describe('decideCartForegroundResumeSync', () => {
  it('never skips when cart is dirty', () => {
    const decision = decideCartForegroundResumeSync({
      isCartDirty: true,
      cartRevision: 2,
      lastSyncedRevision: 1,
      lastSyncAgeMs: 1_000,
      hasPendingMutations: false,
    });
    assert.equal(decision.skip, false);
    assert.equal(decision.reason, 'cart_dirty');
  });

  it('skips when clean and synced within 5 minutes', () => {
    const decision = decideCartForegroundResumeSync({
      isCartDirty: false,
      cartRevision: 4,
      lastSyncedRevision: 4,
      lastSyncAgeMs: CART_RESUME_SKIP_SYNC_WITHIN_MS - 1,
      hasPendingMutations: false,
    });
    assert.equal(decision.skip, true);
    assert.equal(decision.reason, 'clean_recently_synced');
  });

  it('skips stale pending UI flags when recently synced', () => {
    const decision = decideCartForegroundResumeSync({
      isCartDirty: false,
      cartRevision: 4,
      lastSyncedRevision: 4,
      lastSyncAgeMs: 30_000,
      hasPendingMutations: true,
    });
    assert.equal(decision.skip, true);
    assert.equal(decision.reason, 'stale_pending_flags_recently_synced');
  });

  it('runs sync when pending mutations and not recently synced', () => {
    const decision = decideCartForegroundResumeSync({
      isCartDirty: false,
      cartRevision: 4,
      lastSyncedRevision: 4,
      lastSyncAgeMs: CART_RESUME_SKIP_SYNC_WITHIN_MS + 1,
      hasPendingMutations: true,
    });
    assert.equal(decision.skip, false);
    assert.equal(decision.reason, 'pending_mutations');
  });
});
