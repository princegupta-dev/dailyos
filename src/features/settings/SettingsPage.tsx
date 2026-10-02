import { ArrowLeft, HardDrive } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { FoundationNotice } from '@/components/FoundationNotice';
import { PageHeader } from '@/components/PageHeader';

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Habits, date preferences, and your data."
        actions={
          <Link to="/" className="icon-button" aria-label="Back to Today">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
      />
      <FoundationNotice />
      <EmptyState
        icon={HardDrive}
        title="Your data stays on this device"
        description="DailyOS stores everything locally in your browser. Export and restore will live here."
      />
    </>
  );
}
