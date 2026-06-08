import type { ApiAuthLifecycle } from './types';

let authLifecycle: ApiAuthLifecycle = {};

export function registerApiAuthLifecycle(callbacks: ApiAuthLifecycle): void {
  authLifecycle = callbacks;
}

export function getApiAuthLifecycle(): ApiAuthLifecycle {
  return authLifecycle;
}

export function resetApiAuthLifecycleForTests(): void {
  authLifecycle = {};
}
