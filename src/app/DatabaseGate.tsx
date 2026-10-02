import { useEffect, useState, type ReactNode } from 'react';
import { toAppError, type AppError } from '@/db/errors';
import { onDatabaseVersionChange, openDatabase } from '@/services/storage.service';

type GateState = { status: 'opening' } | { status: 'ready' } | { status: 'error'; error: AppError };

/** Renders the app only once local storage is open, and explains clearly if it can't be. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ status: 'opening' });
  const [staleTab, setStaleTab] = useState(false);

  useEffect(() => {
    let active = true;
    openDatabase().then(
      () => {
        if (active) setState({ status: 'ready' });
      },
      (error: unknown) => {
        if (active) setState({ status: 'error', error: toAppError(error) });
      },
    );
    const unsubscribe = onDatabaseVersionChange(() => {
      setStaleTab(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (staleTab) {
    return (
      <GateMessage title="DailyOS was updated in another tab">
        <p>Reload this tab to keep working with the latest version. Your data is safe.</p>
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </button>
      </GateMessage>
    );
  }

  if (state.status === 'opening') {
    return (
      <main className="app-main">
        <p className="loading-state" aria-busy="true">
          Opening your data…
        </p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <GateMessage title="DailyOS can’t open its local storage">
        <p>{state.error.message}</p>
        <p>
          Nothing has been deleted. If you are in a private browsing window, open DailyOS in a
          regular window. Otherwise, check that this site is allowed to store data, then reload.
        </p>
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            window.location.reload();
          }}
        >
          Try again
        </button>
      </GateMessage>
    );
  }

  return <>{children}</>;
}

function GateMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="app-main">
      <div className="error-panel" role="alert">
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}
