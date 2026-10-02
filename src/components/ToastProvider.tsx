import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastMessage } from './toast-context';

const SUCCESS_TIMEOUT_MS = 3500;

interface ActiveToast extends ToastMessage {
  id: number;
}

/**
 * Brief status messages announced to screen readers. Errors stay until dismissed so they
 * cannot be missed; confirmations fade on their own.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const notify = useCallback(
    (toast: ToastMessage) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      if (toast.kind === 'success') {
        timers.current.set(
          id,
          window.setTimeout(() => {
            dismiss(id);
          }, SUCCESS_TIMEOUT_MS),
        );
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
    };
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.kind}`}>
            {toast.kind === 'success' ? (
              <CircleCheck size={18} aria-hidden="true" />
            ) : (
              <CircleAlert size={18} aria-hidden="true" />
            )}
            <span className="toast__message">{toast.message}</span>
            <button
              type="button"
              className="toast__dismiss"
              aria-label="Dismiss"
              onClick={() => {
                dismiss(toast.id);
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
