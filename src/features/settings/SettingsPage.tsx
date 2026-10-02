import { ArrowLeft, ChevronRight, HardDrive } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { DateTimeSettings } from './DateTimeSettings';

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        leading={
          <Link to="/" className="icon-button" aria-label="Back to Today">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
      />

      <Section title="Habits">
        <ul className="nav-list">
          <li>
            <Link to="/habits" className="nav-list__link">
              <span>
                <span className="nav-list__label">Manage habits</span>
                <span className="nav-list__meta">Create, edit, or end habits</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </Section>

      <DateTimeSettings />

      <Section title="Your data">
        <EmptyState
          icon={HardDrive}
          title="Stored only on this device"
          description="DailyOS keeps everything in this browser’s local storage. Backup export and restore are not available yet in this build."
        />
      </Section>
    </>
  );
}
