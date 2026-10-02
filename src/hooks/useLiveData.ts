import { useEffect, useState } from 'react';
import { toAppError, type AppError } from '@/db/errors';
import { subscribeLive } from '@/db/live';

export type LiveData<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: AppError };

interface Tracked<T> {
  source: () => Promise<T>;
  value: LiveData<T>;
}

/**
 * Subscribes to a repository read and re-renders when the underlying records change.
 * Pass a stable function (module-level or `useCallback`); a new function starts a new query
 * and reports `loading` until it resolves, so stale results are never shown for new inputs.
 */
export function useLiveData<T>(query: () => Promise<T>): LiveData<T> {
  const [tracked, setTracked] = useState<Tracked<T> | null>(null);

  useEffect(
    () =>
      subscribeLive(
        query,
        (data) => {
          setTracked({ source: query, value: { status: 'ready', data } });
        },
        (error: unknown) => {
          setTracked({ source: query, value: { status: 'error', error: toAppError(error) } });
        },
      ),
    [query],
  );

  return tracked?.source === query ? tracked.value : { status: 'loading' };
}
