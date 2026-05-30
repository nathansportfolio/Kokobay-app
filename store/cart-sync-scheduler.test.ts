import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { alwaysActiveAppLifecycle } from './cart-app-lifecycle';
import { createCartSyncScheduler } from './cart-sync-scheduler';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('cart sync scheduler', () => {
  it('coalesces rapid scheduleSync calls into one debounced run', async () => {
    let runs = 0;
    const scheduler = createCartSyncScheduler(async () => {
      runs += 1;
    }, { debounceMs: 50, lifecycle: alwaysActiveAppLifecycle });

    scheduler.scheduleSync();
    scheduler.scheduleSync();
    scheduler.scheduleSync();
    assert.equal(scheduler.isDebouncePending(), true);

    await sleep(120);
    assert.equal(runs, 1);
    assert.equal(scheduler.isDebouncePending(), false);
  });

  it('flushSync bypasses debounce and runs immediately', async () => {
    let runs = 0;
    const scheduler = createCartSyncScheduler(async () => {
      runs += 1;
    }, { debounceMs: 500, lifecycle: alwaysActiveAppLifecycle });

    scheduler.scheduleSync();
    assert.equal(scheduler.isDebouncePending(), true);
    await scheduler.flushSync();
    assert.equal(runs, 1);
    assert.equal(scheduler.isDebouncePending(), false);
  });

  it('serializes concurrent flushSync calls on the chain', async () => {
    const order: number[] = [];
    const scheduler = createCartSyncScheduler(async () => {
      order.push(Date.now());
      await sleep(30);
    }, { debounceMs: 20, lifecycle: alwaysActiveAppLifecycle });

    await Promise.all([scheduler.flushSync(), scheduler.flushSync(), scheduler.flushSync()]);
    assert.equal(order.length, 3);
  });

  it('rapid qty spam schedules one run after debounce window', async () => {
    let runs = 0;
    const scheduler = createCartSyncScheduler(async () => {
      runs += 1;
    }, { debounceMs: 40, lifecycle: alwaysActiveAppLifecycle });

    for (let i = 0; i < 10; i += 1) {
      scheduler.scheduleSync();
    }
    await sleep(100);
    assert.equal(runs, 1);
  });
});
