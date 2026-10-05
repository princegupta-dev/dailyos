import { CalendarRange, Flame, Repeat, Sprout, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { ProgressRing } from '@/components/ProgressRing';
import { getWeekConsistency, type HabitSummary } from '@/db/repositories/habits';
import type { Occurrence } from '@/domain/habit';
import { useCountUp } from '@/hooks/useCountUp';
import { useLiveData } from '@/hooks/useLiveData';

interface HabitsOverviewProps {
  /** Active (not ended) habits. */
  active: readonly HabitSummary[];
  recent: ReadonlyMap<string, readonly Occurrence[]>;
  windowDays: number;
  today: string;
  weekStartsOn: number;
}

function encouragement(done: number, due: number): string {
  if (due === 0) return 'Nothing is due today. A rest day counts too.';
  if (done === 0) return 'One small tick is all it takes to begin.';
  if (done < due) return `${due - done} to go. Steady beats perfect.`;
  return 'Every habit done for today. Lovely.';
}

/**
 * Habits at a glance: today's check-offs as a ring, then the longest running streak, this
 * week's consistency, and recent check-ins. Skipped habits never count against anything.
 */
export function HabitsOverview({
  active,
  recent,
  windowDays,
  today,
  weekStartsOn,
}: HabitsOverviewProps) {
  const week = useLiveData(
    useCallback(() => getWeekConsistency(today, weekStartsOn), [today, weekStartsOn]),
  );

  // Due today: habits that can be checked off today and weren't skipped.
  const due = active.filter((s) => s.todayStatus !== null && s.todayStatus !== 'skipped');
  const done = due.filter((s) => s.todayStatus === 'completed').length;
  const percent = due.length === 0 ? 0 : Math.round((done / due.length) * 100);

  const leader = active.reduce<HabitSummary | undefined>(
    (best, s) => (s.stats.currentStreak > (best?.stats.currentStreak ?? 0) ? s : best),
    undefined,
  );
  const checkIns = active.reduce(
    (sum, s) => sum + (recent.get(s.habit.id) ?? []).filter((o) => o.status === 'completed').length,
    0,
  );
  const weekRate =
    week.status === 'ready' && week.data.rate !== null ? Math.round(week.data.rate * 100) : null;

  return (
    <section
      className={`progress-hero habits-overview${due.length > 0 && done === due.length ? ' progress-hero--complete' : ''}`}
      aria-label="Habits overview"
    >
      <div className="progress-hero__main">
        <div className="progress-hero__ring">
          <ProgressRing
            value={done}
            max={due.length}
            size={104}
            stroke={10}
            tone="gradient"
            label={`${done} of ${due.length} habits done today`}
          >
            <span className="progress-hero__percent">
              <CountUp value={percent} />
              <span className="progress-hero__percent-sign">%</span>
            </span>
          </ProgressRing>
        </div>
        <div className="progress-hero__copy">
          <p className="progress-hero__eyebrow">Today</p>
          <p className="progress-hero__headline">
            <em>{done}</em> of {due.length} done
          </p>
          <p className="progress-hero__note">{encouragement(done, due.length)}</p>
        </div>
      </div>
      <dl className="habits-overview__stats">
        <OverviewStat icon={Repeat} label="Active habits" value={String(active.length)} />
        <OverviewStat
          icon={Flame}
          label="Top streak"
          value={
            leader && leader.stats.currentStreak > 0 ? String(leader.stats.currentStreak) : '—'
          }
          detail={
            leader && leader.stats.currentStreak > 0 ? leader.habit.name : 'Starts with a tick'
          }
          tone="warm"
        />
        <OverviewStat
          icon={CalendarRange}
          label="This week"
          value={weekRate === null ? '—' : `${weekRate}%`}
          detail={
            week.status === 'ready' && week.data.counted > 0
              ? `${week.data.completed} of ${week.data.counted} done`
              : 'Nothing due yet'
          }
        />
        <OverviewStat
          icon={Sprout}
          label="Check-ins"
          value={String(checkIns)}
          detail={`Last ${windowDays} days`}
        />
      </dl>
    </section>
  );
}

/** The percentage, counting up. Decorative: the ring announces the real value. */
function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

function OverviewStat({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string | undefined;
  tone?: 'warm' | undefined;
}) {
  return (
    <div className={`overview-stat${tone ? ` overview-stat--${tone}` : ''}`}>
      <dt className="overview-stat__label">
        <span className="overview-stat__icon" aria-hidden="true">
          <Icon size={14} />
        </span>
        {label}
      </dt>
      <dd className="overview-stat__value">{value}</dd>
      {detail && <dd className="overview-stat__detail">{detail}</dd>}
    </div>
  );
}
