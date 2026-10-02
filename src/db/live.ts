import { liveQuery } from 'dexie';

/**
 * Subscribes to a read that re-runs whenever the IndexedDB data it touched changes,
 * including writes from other tabs. Returns an unsubscribe function.
 */
export function subscribeLive<T>(
  query: () => Promise<T>,
  onNext: (value: T) => void,
  onError: (error: unknown) => void,
): () => void {
  const subscription = liveQuery(query).subscribe({ next: onNext, error: onError });
  return () => {
    subscription.unsubscribe();
  };
}
