import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { emptyProfile, sampleProfile, type UserProfile } from '@/domain/profile';
import type { Session } from '@/services/auth.service';
import { useSession } from '../auth/session-context';
import { ProfileContext, type ProfileContextValue } from './profile-context';

/** A brand-new account starts with just its name; anyone else sees sample data. */
function initialProfile(session: Session | null): UserProfile {
  if (!session) return emptyProfile();
  if (!session.isNewAccount) return sampleProfile();
  const fresh = emptyProfile();
  const [first = '', ...rest] = session.user.name.trim().split(/\s+/);
  return { ...fresh, personal: { ...fresh.personal, firstName: first, lastName: rest.join(' ') } };
}

/**
 * The signed-in person's profile, held in memory only. It starts over whenever the account
 * changes, so signing out (or in as someone else) never shows the previous person's details.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const owner = session?.user.email ?? null;
  const [state, setState] = useState(() => ({ owner, profile: initialProfile(session) }));
  if (state.owner !== owner) {
    setState({ owner, profile: initialProfile(session) });
  }

  const saveSection = useCallback<ProfileContextValue['saveSection']>((key, value) => {
    setState((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  }, []);

  const value = useMemo(() => ({ profile: state.profile, saveSection }), [state, saveSection]);
  return <ProfileContext value={value}>{children}</ProfileContext>;
}
