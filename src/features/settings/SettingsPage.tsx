import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { DataSettings } from './DataSettings';
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

      <DataSettings />
    </>
  );
}
