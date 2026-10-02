import { PenLine, Settings } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { useToday } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { HabitDayList } from '../habits/HabitDayList';
import { DailyIntention } from '../planning/DailyIntention';
import { TodayTasks } from '../planning/TodayTasks';
import { EveningReview } from '../reviews/EveningReview';
import { QuickCaptureDialog } from './QuickCaptureDialog';
import { TodayProgress } from './TodayProgress';

/**
 * The daily command center: date, progress, habits, focus, tasks, and the evening review.
 * Kept deliberately short so planning takes a couple of minutes.
 */
export function TodayPage() {
  const today = useToday();
  const [capturing, setCapturing] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow={formatDateKey(today, undefined, { weekday: 'long' })}
        title={formatDateKey(today, undefined, { month: 'long', day: 'numeric' })}
        actions={
          <div className="header-actions">
            <button
              type="button"
              className="icon-button"
              aria-label="Capture a note or task"
              onClick={() => {
                setCapturing(true);
              }}
            >
              <PenLine size={20} aria-hidden="true" />
            </button>
            <Link to="/settings" className="icon-button" aria-label="Settings">
              <Settings size={20} aria-hidden="true" />
            </Link>
          </div>
        }
      />

      <TodayProgress today={today} />

      <Section title="Habits" meta={<Link to="/habits">All habits</Link>}>
        <HabitDayList date={today} today={today} />
      </Section>

      <DailyIntention date={today} />

      <TodayTasks today={today} />

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
