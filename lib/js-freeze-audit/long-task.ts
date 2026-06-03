import { isJsFreezeAuditEnabled } from '@/lib/js-freeze-audit/enabled';
import { isJsFreezeSessionActive, recordJsFreezeLongTask } from '@/lib/js-freeze-audit/state';

const LONG_TASK_THRESHOLD_MS = 16;

export function traceLongTask<T>(name: string, fn: () => T): T {
  if (!isJsFreezeAuditEnabled() || !isJsFreezeSessionActive()) return fn();

  const start = performance.now();
  try {
    return fn();
  } finally {
    recordJsFreezeLongTask(name, performance.now() - start, LONG_TASK_THRESHOLD_MS);
  }
}

export async function traceLongTaskAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!isJsFreezeAuditEnabled() || !isJsFreezeSessionActive()) return fn();

  const start = performance.now();
  try {
    return await fn();
  } finally {
    recordJsFreezeLongTask(name, performance.now() - start, LONG_TASK_THRESHOLD_MS);
  }
}
