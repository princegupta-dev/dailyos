import { BriefcaseBusiness, HeartPulse, Sunrise, UserRound, type LucideIcon } from 'lucide-react';
import type { HabitTone } from '@/domain/appearance';
import {
  validateHealth,
  validateLifestyle,
  validatePersonal,
  validateProfessional,
  type FieldErrors,
  type ProfileSectionKey,
  type UserProfile,
} from '@/domain/profile';

export interface ProfileSectionMeta {
  key: ProfileSectionKey;
  title: string;
  /** Why we ask, shown under the title in setup and on the edit screen. */
  subtitle: string;
  icon: LucideIcon;
  tone: HabitTone;
  /** The section's edit screen under Profile. */
  path: string;
}

export const PROFILE_SECTIONS: readonly ProfileSectionMeta[] = [
  {
    key: 'personal',
    title: 'Personal information',
    subtitle: 'Let’s start with the basics.',
    icon: UserRound,
    tone: 'ocean',
    path: '/profile/personal',
  },
  {
    key: 'health',
    title: 'Health & wellness',
    subtitle: 'Helps personalise your experience.',
    icon: HeartPulse,
    tone: 'teal',
    path: '/profile/health',
  },
  {
    key: 'professional',
    title: 'Professional information',
    subtitle: 'Helps tailor suggestions and planning.',
    icon: BriefcaseBusiness,
    tone: 'indigo',
    path: '/profile/professional',
  },
  {
    key: 'lifestyle',
    title: 'Lifestyle & preferences',
    subtitle: 'Helps with better suggestions.',
    icon: Sunrise,
    tone: 'violet',
    path: '/profile/lifestyle',
  },
];

export function sectionMeta(key: ProfileSectionKey): ProfileSectionMeta {
  const meta = PROFILE_SECTIONS.find((s) => s.key === key);
  if (!meta) throw new Error(`Unknown profile section: ${key}`);
  return meta;
}

export function validateSection(profile: UserProfile, key: ProfileSectionKey): FieldErrors {
  switch (key) {
    case 'personal':
      return validatePersonal(profile.personal);
    case 'health':
      return validateHealth(profile.health);
    case 'professional':
      return validateProfessional(profile.professional);
    case 'lifestyle':
      return validateLifestyle(profile.lifestyle);
  }
}
