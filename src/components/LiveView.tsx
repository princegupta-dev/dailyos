import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LiveData } from '@/hooks/useLiveData';

interface LiveViewProps<T> {
  state: LiveData<T>;
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}

/** Renders loading, error, or ready states of a live query consistently. */
export function LiveView<T>({ state, children, loadingLabel = 'Loading…' }: LiveViewProps<T>) {
  if (state.status === 'loading') {
    return (
      <p className="loading-state" aria-busy="true">
        {loadingLabel}
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="inline-error" role="alert">
        <CircleAlert size={18} aria-hidden="true" />
        <span>{state.error.message}</span>
      </div>
    );
  }
  return <>{children(state.data)}</>;
}
