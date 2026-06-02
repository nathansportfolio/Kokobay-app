import {
  getResumeNetworkTrigger,
  networkRequestCompleted,
  networkRequestStarted,
} from '@/lib/lifecycle-perf';

/** Default deadline for mobile API requests — avoids hung loading states. */
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

export class FetchTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

export class HttpResponseError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'HttpResponseError';
    this.status = status;
    this.url = url;
  }
}

function mergeAbortSignals(
  userSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
): AbortSignal {
  if (!userSignal) return timeoutSignal;
  if (userSignal.aborted) return userSignal;
  if (timeoutSignal.aborted) return timeoutSignal;

  const merged = new AbortController();
  const abort = () => merged.abort();
  userSignal.addEventListener('abort', abort);
  timeoutSignal.addEventListener('abort', abort);
  return merged.signal;
}

/**
 * `fetch` with a hard timeout. Preserves caller `signal` (React Query abort, etc.).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = mergeAbortSignals(init.signal ?? undefined, timeoutController.signal);

  const networkId = __DEV__
    ? networkRequestStarted(url, init.method ?? 'GET', getResumeNetworkTrigger())
    : 0;

  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    if (timeoutController.signal.aborted && !init.signal?.aborted) {
      throw new FetchTimeoutError(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (__DEV__) networkRequestCompleted(networkId);
  }
}
