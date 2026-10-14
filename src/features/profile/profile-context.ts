import { createContext, useContext } from 'react';
import type { ProfileSectionKey, UserProfile } from '@/domain/profile';

export interface ProfileContextValue {
  profile: UserProfile;
  /** Replaces one section, e.g. after saving its edit screen or a setup step. */
  saveSection: <K extends ProfileSectionKey>(key: K, value: UserProfile[K]) => void;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfile must be used inside ProfileProvider');
  return value;
}
