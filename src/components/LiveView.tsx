import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LiveData } from '@/hooks/useLiveData';

interface LiveViewProps<T> {
  state: LiveData<T>;
  children: (data: T) => ReactNode;
  loadingLabel?: string;
  /** Placeholder shaped like the content, shown while loading instead of the spinner. */
  skeleton?: ReactNode;
}

/** Renders loading, error, or ready states of a live query consistently. */
export function LiveView<T>({
  state,
  children,
  loadingLabel = 'Loading…',
  skeleton,
}: LiveViewProps<T>) {
  if (state.status === 'loading') {
    if (skeleton !== undefined) {
      return (
        <div className="skeleton-group" aria-busy="true">
          <span className="visually-hidden" role="status">
            {loadingLabel}
          </span>
          <div aria-hidden="true">{skeleton}</div>
        </div>
      );
    }
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

/** A stack of shimmering card placeholders for list skeletons. */
export function SkeletonCards({ count = 3, height = 68 }: { count?: number; height?: number }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton skeleton--card" style={{ height }} />
      ))}
    </div>
  );
}
