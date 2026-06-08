/**
 * Serializes auth refresh and optionally coalesces identical in-flight GET requests.
 */
export class RequestQueue {
  private refreshPromise: Promise<unknown> | null = null;
  private readonly inflight = new Map<string, Promise<unknown>>();

  /** Only one session refresh runs at a time; concurrent callers await the same result. */
  runAuthRefresh<T>(refreshFn: () => Promise<T>): Promise<T> {
    if (this.refreshPromise) return this.refreshPromise as Promise<T>;

    const promise = refreshFn().finally(() => {
      this.refreshPromise = null;
    });

    this.refreshPromise = promise;
    return promise;
  }

  /** Deduplicate identical in-flight GETs (same method + path + auth mode). */
  coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fn().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }

  /** Test helper — clear pending state. */
  reset(): void {
    this.refreshPromise = null;
    this.inflight.clear();
  }
}

export const requestQueue = new RequestQueue();
