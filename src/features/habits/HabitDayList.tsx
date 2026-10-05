import { PartyPopper, Repeat } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LiveView, SkeletonCards } from '@/components/LiveView';
import { getHabitsForDay, type HabitDayStatus } from '@/db/repositories/habits';
import { useLiveData } from '@/hooks/useLiveData';
import { useWeekStartsOn } from '@/hooks/useToday';
import { HabitLogSheet } from './HabitLogSheet';
import { HabitRow } from './HabitRow';

/** Habits scheduled on `date` with one-tap completion and an optional log sheet. */
export function HabitDayList({ date, today }: { date: string; today: string }) {
  const weekStartsOn = useWeekStartsOn();
  const habits = useLiveData(
    useCallback(() => getHabitsForDay(date, today, weekStartsOn), [date, today, weekStartsOn]),
  );
  const [logging, setLogging] = useState<HabitDayStatus | null>(null);

  return (
    <LiveView state={habits} loadingLabel="Loading habits…" skeleton={<SkeletonCards />}>
      {(items) =>
        items.length === 0 ? (
          <>
            <EmptyState
              icon={Repeat}
              title="No habits scheduled today"
              description="Habits appear here on the days they're scheduled. Unscheduled days never count against you."
            />
            <Link
              to="/habits/new"
              className="button button--secondary button--block section__action"
            >
              Create a habit
            </Link>
          </>
        ) : (
          <>
            <ul className="habit-list" aria-label="Habits for today">
              {items.map((item) => (
                <HabitRow
                  key={item.habit.id}
                  habit={item.habit}
                  date={date}
                  status={item.occurrence.status}
                  entry={item.entry}
                  currentStreak={item.stats.currentStreak}
                  onOpenLog={() => {
                    setLogging(item);
                  }}
                />
              ))}
            </ul>
            <AllDone items={items} />
            {logging && (
              <HabitLogSheet
                key={logging.habit.id}
                habit={logging.habit}
                date={date}
                today={today}
                entry={items.find((i) => i.habit.id === logging.habit.id)?.entry}
                onClose={() => {
                  setLogging(null);
                }}
              />
            )}
          </>
        )
      }
    </LiveView>
  );
}

/**
 * A small celebration once every habit that counts today is done. Skipped habits don't
 * count, so skipping never blocks it. Announced politely when it appears.
 */
function AllDone({ items }: { items: readonly HabitDayStatus[] }) {
  const counted = items.filter((i) => i.occurrence.status !== 'skipped');
  const done = counted.length > 0 && counted.every((i) => i.occurrence.status === 'completed');
  return (
    <div role="status" className="habit-celebrate-region">
      {done && (
        <p className="habit-celebrate">
          <span className="habit-celebrate__icon" aria-hidden="true">
            <PartyPopper size={18} />
          </span>
          <span>
            Every habit done. <em>Lovely, steady work.</em>
          </span>
        </p>
      )}
    </div>
  );
}
