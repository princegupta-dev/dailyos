import { createContext, useContext } from 'react';
import type { Session } from '@/services/auth.service';

export interface SessionContextValue {
  session: Session | null;
  /** Starts a session after a successful sign-in or sign-up. */
  begin: (session: Session) => void;
  /** Marks profile setup as finished (completed or skipped). */
  finishProfileSetup: () => void;
  /** Ends the session and forgets frontend state. Data on this device is left as is. */
  end: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
