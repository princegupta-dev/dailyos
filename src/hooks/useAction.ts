import { useCallback, useContext, useState } from 'react';
import { ToastContext } from '@/components/toast-context';
import { toAppError } from '@/db/errors';

export type ActionResult<T> = { ok: true; value: T } | { ok: false };

/**
 * Runs a write and reports the outcome: a confirmation toast on success, the error's
 * user-facing message on failure.
 */
export function useAction() {
  const notify = useContext(ToastContext);
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async <T>(operation: () => Promise<T>, successMessage?: string): Promise<ActionResult<T>> => {
      setPending(true);
      try {
        const result = await operation();
        if (successMessage) notify({ kind: 'success', message: successMessage });
        return { ok: true, value: result };
      } catch (error) {
        notify({ kind: 'error', message: toAppError(error).message });
        return { ok: false };
      } finally {
        setPending(false);
      }
    },
    [notify],
  );

  return { run, pending, notify };
}
