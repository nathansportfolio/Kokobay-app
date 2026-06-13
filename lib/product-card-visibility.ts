import { useSyncExternalStore } from 'react';

const visibleProductIds = new Set<string>();
const listenersByProductId = new Map<string, Set<() => void>>();

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

function notifyProductVisibility(productId: string): void {
  listenersByProductId.get(productId)?.forEach((listener) => listener());
}

/** Updates visible product ids — only notifies cards whose visibility changed. */
export function syncVisibleProductCardIds(nextIds: Iterable<string>): void {
  const next = new Set(nextIds);
  if (setsEqual(visibleProductIds, next)) return;

  for (const id of visibleProductIds) {
    if (!next.has(id)) {
      visibleProductIds.delete(id);
      notifyProductVisibility(id);
    }
  }

  for (const id of next) {
    if (!visibleProductIds.has(id)) {
      visibleProductIds.add(id);
      notifyProductVisibility(id);
    }
  }
}

export function clearVisibleProductCardIds(): void {
  if (visibleProductIds.size === 0) return;
  const previous = [...visibleProductIds];
  visibleProductIds.clear();
  previous.forEach(notifyProductVisibility);
}

function subscribeProductVisibility(productId: string, listener: () => void): () => void {
  let listeners = listenersByProductId.get(productId);
  if (!listeners) {
    listeners = new Set();
    listenersByProductId.set(productId, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners?.delete(listener);
    if (listeners?.size === 0) {
      listenersByProductId.delete(productId);
    }
  };
}

function getProductVisibilitySnapshot(productId: string): boolean {
  return visibleProductIds.has(productId);
}

/** Per-card viewport visibility — does not require list `extraData` updates. */
export function useProductCardVisible(productId: string): boolean {
  return useSyncExternalStore(
    (listener) => subscribeProductVisibility(productId, listener),
    () => getProductVisibilitySnapshot(productId),
    () => false,
  );
}
