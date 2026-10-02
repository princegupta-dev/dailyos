import { useCallback } from 'react';
import { ProgressRing } from '@/components/ProgressRing';
import { getHabitsForDay, getWeekConsistency } from '@/db/repositories/habits';
import { useLiveData } from '@/hooks/useLiveData';
import { useWeekStartsOn } from '@/hooks/useToday';

/** A small, neutral consistency indicator. No scores, no streak pressure. */
export function TodayProgress({ today }: { today: string }) {
  const weekStartsOn = useWeekStartsOn();
  const habits = useLiveData(
    useCallback(() => getHabitsForDay(today, today, weekStartsOn), [today, weekStartsOn]),
  );
  const week = useLiveData(
    useCallback(() => getWeekConsistency(today, weekStartsOn), [today, weekStartsOn]),
  );

  if (habits.status !== 'ready' || habits.data.length === 0) return null;
  // Skipped habits are left out of today's count; they're a choice, not a failure.
  const counted = habits.data.filter((h) => h.occurrence.status !== 'skipped');
  const done = counted.filter((h) => h.occurrence.status === 'completed').length;

  return (
    <section className="progress-card" aria-label="Today’s progress">
      <div>
        <p className="progress-card__label">Today’s habits</p>
        <p className="progress-card__value">
          {done}
          <span className="progress-card__of">/{counted.length}</span>
        </p>
        {week.status === 'ready' && week.data.counted > 0 && (
          <p className="progress-card__note">
            This week so far: {week.data.completed} of {week.data.counted} done
          </p>
        )}
      </div>
      <ProgressRing
        value={done}
        max={counted.length}
        label={`${done} of ${counted.length} habits done today`}
      />
    </section>
  );
}
