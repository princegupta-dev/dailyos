import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { listHabitSummaries } from '@/db/repositories/habits';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { Plus, Repeat } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { HabitRow } from './HabitRow';

/** Every habit in one list: check off today's from here, tap a card for its details. */
export function HabitsPage() {
  const today = useToday();
  const weekStartsOn = useWeekStartsOn();
  const [showEnded, setShowEnded] = useState(false);
  const summaries = useLiveData(
    useCallback(() => listHabitSummaries(today, weekStartsOn, true), [today, weekStartsOn]),
  );

  return (
    <>
      <PageHeader
        eyebrow={formatDateKey(today, undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        title="Habits"
        actions={
          <Link to="/habits/new" className="icon-button" aria-label="New habit">
            <Plus size={20} aria-hidden="true" />
          </Link>
        }
      />
      <LiveView state={summaries}>
        {(all) => {
          const active = all.filter((s) => s.habit.archivedOn === undefined);
          const ended = all.filter((s) => s.habit.archivedOn !== undefined);
          const visible = showEnded ? [...active, ...ended] : active;
          if (all.length === 0) {
            return (
              <>
                <EmptyState
                  icon={Repeat}
                  title="No habits yet"
                  description="Start with one or two small habits. You can add details and alternatives later."
                />
                <Link
                  to="/habits/new"
                  className="button button--primary button--block section__action"
                >
                  Create your first habit
                </Link>
              </>
            );
          }
          return (
            <>
              {visible.length > 0 && (
                <ul className="habit-list" aria-label="All habits">
                  {visible.map(({ habit, stats, todayEntry, todayStatus }) => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      date={today}
                      status={todayStatus}
                      entry={todayEntry}
                      currentStreak={stats.currentStreak}
                    />
                  ))}
                </ul>
              )}
              {ended.length > 0 && (
                <button
                  type="button"
                  className="link-button section__action"
                  onClick={() => {
                    setShowEnded((v) => !v);
                  }}
                >
                  {showEnded ? 'Hide ended habits' : `Show ended habits (${ended.length})`}
                </button>
              )}
            </>
          );
        }}
      </LiveView>
    </>
  );
}
