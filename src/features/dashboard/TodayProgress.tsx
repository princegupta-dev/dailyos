import { ListChecks, Repeat, Sparkles, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { ProgressRing } from '@/components/ProgressRing';
import { getHabitsForDay } from '@/db/repositories/habits';
import { getDayPlan } from '@/db/repositories/plans';
import { useCountUp } from '@/hooks/useCountUp';
import { useLiveData } from '@/hooks/useLiveData';
import { useWeekStartsOn } from '@/hooks/useToday';
import { WeekStrip } from './WeekStrip';

/**
 * Gentle encouragement by share of the day done. Calm on purpose: no scores, no streak
 * pressure, and nothing that reads as a failure.
 */
function encouragement(percent: number): string {
  if (percent === 0) return 'Every good day starts with one small tick.';
  if (percent < 34) return 'A good start. Momentum builds from here.';
  if (percent < 67) return 'You’re making real progress.';
  if (percent < 100) return 'Nearly there. Finish the day your way.';
  return 'Everything’s done. Enjoy the rest of your day.';
}

interface Tally {
  done: number;
  total: number;
}

/** The day at a glance: habits and planned tasks done, plus this week's habits day by day. */
export function TodayProgress({ today }: { today: string }) {
  const weekStartsOn = useWeekStartsOn();
  const habits = useLiveData(
    useCallback(() => getHabitsForDay(today, today, weekStartsOn), [today, weekStartsOn]),
  );
  const dayPlan = useLiveData(useCallback(() => getDayPlan(today, today), [today]));

  if (habits.status === 'error' || dayPlan.status === 'error') return null;
  if (habits.status !== 'ready' || dayPlan.status !== 'ready') {
    return (
      <section className="progress-hero progress-hero--loading" aria-label="Today’s progress">
        <span className="visually-hidden" role="status">
          Loading today’s progress…
        </span>
        <div className="skeleton skeleton--ring" aria-hidden="true" />
        <div className="progress-hero__skeleton-lines" aria-hidden="true">
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      </section>
    );
  }

  // Skipped habits are left out of today's count; they're a choice, not a failure.
  const countedHabits = habits.data.filter((h) => h.occurrence.status !== 'skipped');
  const habitTally: Tally = {
    done: countedHabits.filter((h) => h.occurrence.status === 'completed').length,
    total: countedHabits.length,
  };
  // Same counting as the Tasks section: moved and cancelled tasks don't count.
  const countedTasks = dayPlan.data.entries.filter(
    (e) => e.outcome !== 'rescheduled' && e.outcome !== 'cancelled',
  );
  const taskTally: Tally = {
    done: countedTasks.filter((e) => e.outcome === 'done').length,
    total: countedTasks.length,
  };
  const done = habitTally.done + taskTally.done;
  const total = habitTally.total + taskTally.total;

  if (total === 0) {
    return (
      <section className="progress-hero progress-hero--empty" aria-label="Today’s progress">
        <span className="progress-hero__empty-icon" aria-hidden="true">
          <Sparkles size={22} />
        </span>
        <div>
          <p className="progress-hero__eyebrow">Your day</p>
          <p className="progress-hero__headline">
            A <em>fresh</em> page
          </p>
          <p className="progress-hero__note">
            Nothing is scheduled yet. Plan a task or add a habit and your day takes shape here.
          </p>
        </div>
      </section>
    );
  }

  const percent = Math.round((done / total) * 100);
  const complete = done === total;

  return (
    <section
      className={`progress-hero${complete ? ' progress-hero--complete' : ''}`}
      aria-label="Today’s progress"
    >
      <div className="progress-hero__main">
        <div className="progress-hero__ring">
          <ProgressRing
            value={done}
            max={total}
            size={112}
            stroke={10}
            tone="gradient"
            label={`${done} of ${total} done today`}
          >
            <span className="progress-hero__percent">
              <CountUp value={percent} />
              <span className="progress-hero__percent-sign">%</span>
            </span>
          </ProgressRing>
          {complete && <span className="progress-hero__sparkles" aria-hidden="true" />}
        </div>
        <div className="progress-hero__copy">
          <p className="progress-hero__eyebrow">Your day</p>
          <p className="progress-hero__headline">
            {complete ? (
              <>
                All <em>done</em>
              </>
            ) : (
              <>
                <em>{percent}%</em> complete
              </>
            )}
          </p>
          <p className="progress-hero__note">{encouragement(percent)}</p>
        </div>
      </div>
      <dl className="progress-hero__stats">
        {habitTally.total > 0 && (
          <Stat icon={Repeat} label="Habits" tally={habitTally} unit="habits done today" />
        )}
        {taskTally.total > 0 && (
          <Stat icon={ListChecks} label="Tasks" tally={taskTally} unit="tasks done today" />
        )}
      </dl>
      <WeekStrip today={today} weekStartsOn={weekStartsOn} />
    </section>
  );
}

/** The percentage, counting up to its value. Decorative: the ring announces the real value. */
function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

interface StatProps {
  icon: LucideIcon;
  label: string;
  tally: Tally;
  /** Completes the bar's spoken label, e.g. "habits done today" → "2 of 4 habits done today". */
  unit: string;
}

function Stat({ icon: Icon, label, tally, unit }: StatProps) {
  const fraction = tally.total === 0 ? 0 : tally.done / tally.total;
  return (
    <div className="progress-stat">
      <dt className="progress-stat__label">
        <Icon size={14} aria-hidden="true" />
        {label}
      </dt>
      <dd className="progress-stat__value">
        {tally.done}
        <span className="progress-stat__of"> of {tally.total}</span>
      </dd>
      <dd
        className="progress-stat__bar"
        role="img"
        aria-label={`${tally.done} of ${tally.total} ${unit}`}
      >
        <span style={{ inlineSize: `${Math.round(fraction * 100)}%` }} />
      </dd>
    </div>
  );
}
