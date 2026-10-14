import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { loadSession, saveSession, signOut, type Session } from '@/services/auth.service';
import { SessionContext, type SessionContextValue } from './session-context';

/** Holds the signed-in session for the whole app. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);

  const update = useCallback((next: Session | null) => {
    saveSession(next);
    setSession(next);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      begin: update,
      finishProfileSetup: () => {
        if (session) update({ ...session, profileSetupDone: true, isNewAccount: false });
      },
      end: async () => {
        await signOut();
        update(null);
      },
    }),
    [session, update],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
