import { Moon, Plus, Settings } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { useToday } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { TodayHabits } from '../habits/TodayHabits';
import { RecentLearning } from '../learning/RecentLearning';
import { DailyIntention } from '../planning/DailyIntention';
import { TodayTasks } from '../planning/TodayTasks';
import { QuickCaptureDialog } from './QuickCaptureDialog';

export function TodayPage() {
  const today = useToday();
  const [capturing, setCapturing] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Today"
        title={formatDateKey(today)}
        actions={
          <Link to="/settings" className="icon-button" aria-label="Settings">
            <Settings size={20} aria-hidden="true" />
          </Link>
        }
      />

      <div className="today-capture">
        <button
          type="button"
          className="button button--primary button--block"
          onClick={() => {
            setCapturing(true);
          }}
        >
          <Plus size={20} aria-hidden="true" />
          Quick capture
        </button>
      </div>

      <DailyIntention date={today} />

      <TodayTasks today={today} />

      <TodayHabits today={today} />

      <RecentLearning today={today} />

      <Section title="Evening review">
        <EmptyState
          icon={Moon}
          title="Reflect at the end of the day"
          description="Daily reviews are not available yet in this build."
        />
      </Section>

      {capturing && (
        <QuickCaptureDialog
          today={today}
          onClose={() => {
            setCapturing(false);
          }}
        />
      )}
    </>
  );
}
