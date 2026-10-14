import {
  ChevronRight,
  Database,
  Info,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UserRoundCog,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmDialog } from '@/components/Dialog';
import { PageHero } from '@/components/PageHero';
import { Section } from '@/components/Section';
import { summarizeSection } from '@/domain/profile';
import { useToday } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { AUTH_ROUTES } from '../auth/authRoutes';
import { useSession } from '../auth/session-context';
import { SettingsCard, SettingsLinkRow } from '../settings/SettingsRow';
import { useProfile } from './profile-context';
import { ProfileSummaryCard } from './ProfileSummaryCard';
import { PROFILE_SECTIONS } from './sections';

/** The Profile hub: who's signed in, their details, the app's preferences and data. */
export function ProfilePage() {
  const today = useToday();
  const { profile } = useProfile();
  const { end } = useSession();
  const navigate = useNavigate();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const logOut = async () => {
    setLoggingOut(true);
    await end();
    void navigate(AUTH_ROUTES.welcome, { replace: true });
  };

  return (
    <div className="settings-page">
      <PageHero
        eyebrow={formatDateKey(today, undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
        title="Profile"
        subtitle={
          <>
            Your space, your data, <em>your choices</em>.
          </>
        }
      />

      <ProfileSummaryCard />

      <Section title="About you" icon={UserRound} className="settings-group">
        <SettingsCard>
          {PROFILE_SECTIONS.map((s) => (
            <SettingsLinkRow
              key={s.key}
              to={s.path}
              icon={s.icon}
              tone={s.tone}
              title={s.title}
              description={summarizeSection(profile, s.key)}
            />
          ))}
        </SettingsCard>
      </Section>

      <Section title="App & account" icon={UserRoundCog} className="settings-group">
        <SettingsCard>
          <SettingsLinkRow
            to="/profile/preferences"
            icon={SlidersHorizontal}
            tone="amber"
            title="App preferences"
            description="Greeting, week start, time zone, money defaults, and reminders"
          />
          <SettingsLinkRow
            to="/profile/data"
            icon={Database}
            tone="sage"
            title="Data & privacy"
            description="Privacy, backup and restore, and clearing data"
          />
          <SettingsLinkRow
            to="/profile/account"
            icon={ShieldCheck}
            tone="coral"
            title="Account & security"
            description="Sign-in method, email, and password"
          />
          <SettingsLinkRow
            to="/profile/help"
            icon={LifeBuoy}
            tone="rose"
            title="Help & support"
            description="FAQs, contact, and feedback"
          />
          <SettingsLinkRow
            to="/profile/about"
            icon={Info}
            tone="slate"
            title="About"
            description="Works offline, and installs as an app"
          />
        </SettingsCard>
      </Section>

      <button
        type="button"
        className="logout-row"
        onClick={() => {
          setConfirmingLogout(true);
        }}
      >
        <span className="logout-row__icon" aria-hidden="true">
          <LogOut size={17} />
        </span>
        <span className="logout-row__label">Log out</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      <ConfirmDialog
        open={confirmingLogout}
        title="Log out?"
        message="Are you sure you want to log out of DailyOS?"
        confirmLabel="Log out"
        cancelLabel="Cancel"
        destructive
        pending={loggingOut}
        onConfirm={() => void logOut()}
        onCancel={() => {
          setConfirmingLogout(false);
        }}
      />
    </div>
  );
}
