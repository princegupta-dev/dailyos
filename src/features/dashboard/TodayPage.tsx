import { Plus, Settings } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { useToday } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { TodayHabits } from '../habits/TodayHabits';
import { RecentLearning } from '../learning/RecentLearning';
import { EveningReview } from '../reviews/EveningReview';
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

      <EveningReview today={today} />

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
