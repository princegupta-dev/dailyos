import {
  ArrowLeft,
  BellOff,
  CircleCheckBig,
  Clock,
  Database,
  Info,
  Plus,
  Repeat,
  WifiOff,
} from 'lucide-react';
import { Link } from 'react-router';
import { Section } from '@/components/Section';
import { DataSettings } from './DataSettings';
import { DateTimeSettings } from './DateTimeSettings';
import { ProfileCard } from './ProfileCard';
import { SettingsCard, SettingsLinkRow, SettingsRow } from './SettingsRow';

const JUMPS = [
  { id: 'settings-habits', label: 'Habits' },
  { id: 'settings-time', label: 'Date & time' },
  { id: 'settings-data', label: 'Data & privacy' },
  { id: 'settings-about', label: 'About' },
] as const;

export function SettingsPage() {
  return (
    <div className="settings-page">
      <header className="settings-hero">
        <Link to="/" className="settings-hero__back" aria-label="Back to Today">
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div className="settings-hero__text">
          <p className="settings-hero__eyebrow">Make DailyOS yours</p>
          <h1 className="settings-hero__title">Settings</h1>
        </div>
      </header>

      <ProfileCard />

      <nav className="settings-jump" aria-label="Settings sections">
        {JUMPS.map(({ id, label }) => (
          <a key={id} href={`#${id}`} className="settings-jump__link">
            {label}
          </a>
        ))}
      </nav>

      <div id="settings-habits" className="settings-anchor">
        <Section
          title="Habits & reminders"
          icon={Repeat}
          description="What you track, and how it shows up."
          className="settings-group"
        >
          <SettingsCard>
            <SettingsLinkRow
              to="/habits"
              icon={CircleCheckBig}
              title="Manage habits"
              description="Create, edit, or end habits"
            />
            <SettingsLinkRow
              to="/habits/new"
              icon={Plus}
              tone="teal"
              title="New habit"
              description="Pick an area, a schedule, and a time of day"
            />
            <SettingsRow
              icon={BellOff}
              tone="amber"
              title="Reminders"
              description={
                <>
                  A habit’s time of day and cue show on Today as a gentle anchor. DailyOS never
                  sends notifications, so it <em>never nags</em>.
                </>
              }
            />
          </SettingsCard>
        </Section>
      </div>

      <div id="settings-time" className="settings-anchor">
        <DateTimeSettings icon={Clock} />
      </div>

      <div id="settings-data" className="settings-anchor">
        <DataSettings icon={Database} />
      </div>

      <div id="settings-about" className="settings-anchor">
        <Section title="About" icon={Info} className="settings-group">
          <SettingsCard>
            <SettingsRow
              icon={WifiOff}
              tone="slate"
              title="Works offline"
              description="Install DailyOS from your browser to use it like an app, with or without a connection."
            />
          </SettingsCard>
          <p className="settings-footer">
            DailyOS · <em>small steps, kept kindly</em>
          </p>
        </Section>
      </div>
    </div>
  );
}
