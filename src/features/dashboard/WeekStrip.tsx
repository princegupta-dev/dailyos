import { CalendarRange } from 'lucide-react';
import { useCallback } from 'react';
import { getHabitsForDay } from '@/db/repositories/habits';
import { useLiveData } from '@/hooks/useLiveData';
import { addDays, formatDateKey, startOfWeek } from '@/lib/dates';

interface DayTally {
  date: string;
  done: number;
  counted: number;
}

/**
 * Habit completion for each day of this week so far. Weekly habits are left out: they span
 * the whole week, so counting them per day would repeat them seven times. Skipped habits
 * don't count, as everywhere else.
 */
async function loadWeek(today: string, weekStartsOn: 0 | 1): Promise<DayTally[]> {
  const start = startOfWeek(today, weekStartsOn);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d <= today);
  return Promise.all(
    days.map(async (date) => {
      const habits = (await getHabitsForDay(date, today, weekStartsOn)).filter(
        (h) => h.habit.frequency !== 'weekly' && h.occurrence.status !== 'skipped',
      );
      return {
        date,
        done: habits.filter((h) => h.occurrence.status === 'completed').length,
        counted: habits.length,
      };
    }),
  );
}

/** Seven small columns, Monday (or Sunday) to Sunday, filled by each day's habit share. */
export function WeekStrip({ today, weekStartsOn }: { today: string; weekStartsOn: 0 | 1 }) {
  const week = useLiveData(useCallback(() => loadWeek(today, weekStartsOn), [today, weekStartsOn]));
  if (week.status !== 'ready') return null;
  // Nothing to show until at least one day has a scheduled daily habit.
  if (week.data.every((d) => d.counted === 0)) return null;

  const start = startOfWeek(today, weekStartsOn);
  const byDate = new Map(week.data.map((d) => [d.date, d]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="progress-hero__week">
      <p className="progress-hero__week-title" aria-hidden="true">
        <CalendarRange size={14} />
        This week
      </p>
      <ol className="week-strip" aria-label="Habits this week, day by day">
        {days.map((date) => {
          const tally = byDate.get(date);
          const future = date > today;
          const fraction = tally && tally.counted > 0 ? tally.done / tally.counted : 0;
          const full = tally !== undefined && tally.counted > 0 && tally.done === tally.counted;
          const label = formatDateKey(date, undefined, { weekday: 'long' });
          const description = future
            ? `${label}: still ahead`
            : tally && tally.counted > 0
              ? `${label}: ${tally.done} of ${tally.counted} habits`
              : `${label}: no habits scheduled`;
          return (
            <li
              key={date}
              className={`week-strip__day${date === today ? ' week-strip__day--today' : ''}${future ? ' week-strip__day--future' : ''}${full ? ' week-strip__day--full' : ''}`}
              aria-label={description}
            >
              <span className="week-strip__bar" aria-hidden="true">
                <span style={{ blockSize: `${Math.round(fraction * 100)}%` }} />
              </span>
              <span className="week-strip__label" aria-hidden="true">
                {formatDateKey(date, undefined, { weekday: 'narrow' })}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
