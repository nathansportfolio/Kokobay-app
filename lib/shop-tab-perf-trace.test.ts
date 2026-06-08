import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  logShopTabFirstImageLoad,
  logShopTabViewportImageLoad,
  markShopTabViewportExpected,
  resetShopTabPerfTrace,
  resetShopTabPerfTraceForTests,
} from '@/lib/shop-tab-perf-trace';

describe('shop-tab-perf-trace', () => {
  beforeEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    resetShopTabPerfTraceForTests();
    resetShopTabPerfTrace({ routeKey: 'test' });
    markShopTabViewportExpected(3);
  });

  afterEach(() => {
    resetShopTabPerfTraceForTests();
  });

  it('logs first_image_visible_ms once for row 0', () => {
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };

    try {
      logShopTabFirstImageLoad({ handle: 'new-in' });
      logShopTabFirstImageLoad({ handle: 'new-in' });
    } finally {
      console.log = original;
    }

    const firstImageLogs = logs.filter((line) => line.includes('first_image_visible_ms='));
    assert.equal(firstImageLogs.length, 1);
  });

  it('logs viewport_complete_ms after expected rows load', () => {
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };

    try {
      logShopTabViewportImageLoad(0, { handle: 'a' });
      logShopTabViewportImageLoad(1, { handle: 'b' });
      assert.equal(
        logs.some((line) => line.includes('viewport_complete_ms=')),
        false,
      );
      logShopTabViewportImageLoad(2, { handle: 'c' });
    } finally {
      console.log = original;
    }

    const viewportLogs = logs.filter((line) => line.includes('viewport_complete_ms='));
    assert.equal(viewportLogs.length, 1);
  });
});
