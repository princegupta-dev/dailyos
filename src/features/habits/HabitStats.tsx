import {
  Award,
  CalendarHeart,
  Clock3,
  Feather,
  Flame,
  Lightbulb,
  Shuffle,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { ProgressRing } from '@/components/ProgressRing';
import { SegmentedControl } from '@/components/SegmentedControl';
import type { HabitEntry, Occurrence, OccurrenceSummary } from '@/domain/habit';
import { useCountUp } from '@/hooks/useCountUp';
import { formatDateKey } from '@/lib/dates';
import { inlineDayLabel, relativeDayLabel } from '@/lib/format';
import type { ReactNode } from 'react';
import { nextMilestone, strongestWeekday, type DayState, type WeekBar } from './habitHistory';

/* ---------- Streak ---------- */

interface StreakPanelProps {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  weekly: boolean;
}

/**
 * Current streak front and center, with best and total beside it. Shows progress toward the
 * best streak and the next milestone; matching the best is marked as a small moment.
 */
export function StreakPanel({
  currentStreak,
  longestStreak,
  totalCompletions,
  weekly,
}: StreakPanelProps) {
  const unit = weekly ? 'week' : 'day';
  const toBest = longestStreak === 0 ? 0 : Math.min(currentStreak / longestStreak, 1);
  const personalBest = currentStreak > 1 && currentStreak >= longestStreak;
  const milestone = nextMilestone(currentStreak);
  const shown = useCountUp(currentStreak);

  return (
    <section className="streak-panel" aria-label="Streaks">
      <dl className="streak-panel__stats">
        <div className="streak-panel__main">
          <dt className="streak-panel__label">Streak</dt>
          <dd className="streak-panel__value">
            <span className="streak-panel__flame" aria-hidden="true">
              <Flame size={26} />
            </span>
            <span aria-hidden="true">{shown}</span>
            <span className="visually-hidden">{currentStreak}</span>
            <span className="streak-panel__unit">
              {' '}
              {unit}
              {currentStreak === 1 ? '' : 's'}
            </span>
          </dd>
        </div>
        <div className="streak-panel__side">
          <dt>Best</dt>
          <dd>{longestStreak}</dd>
        </div>
        <div className="streak-panel__side">
          <dt>Total</dt>
          <dd>{totalCompletions}</dd>
        </div>
      </dl>

      {longestStreak > 0 && (
        <div className="streak-panel__progress">
          <span
            className="streak-panel__bar"
            role="img"
            aria-label={`Current streak is ${Math.round(toBest * 100)}% of your best`}
          >
            <span style={{ inlineSize: `${Math.round(toBest * 100)}%` }} />
          </span>
          <p className="streak-panel__note">
            {personalBest ? (
              <span className="streak-panel__moment">
                <Award size={14} aria-hidden="true" /> Personal best. <em>Keep it gentle.</em>
              </span>
            ) : currentStreak === 0 ? (
              'One check-in starts a new streak.'
            ) : milestone ? (
              <>
                {milestone - currentStreak} {unit}
                {milestone - currentStreak === 1 ? '' : 's'} to a {milestone}-{unit} streak
              </>
            ) : (
              'Past every milestone. Remarkable.'
            )}
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------- Consistency ---------- */

export type Range = 'week' | 'month' | '30' | 'all';
const RANGES: readonly { value: Range; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: '30', label: '30 days' },
  { value: 'all', label: 'All' },
];

interface ConsistencyCardProps {
  range: Range;
  onRangeChange: (range: Range) => void;
  period: OccurrenceSummary;
  trend: readonly WeekBar[];
}

/** Completion rate for a chosen period as a ring, with a twelve-week trend beneath. */
export function ConsistencyCard({ range, onRangeChange, period, trend }: ConsistencyCardProps) {
  const percent = period.rate === null ? null : Math.round(period.rate * 100);
  return (
    <section className="detail-card consistency" aria-labelledby="consistency-title">
      <div className="detail-card__head">
        <h2 id="consistency-title" className="detail-card__title">
          <TrendingUp size={17} aria-hidden="true" /> Consistency
        </h2>
      </div>
      <SegmentedControl label="Period" value={range} options={RANGES} onChange={onRangeChange} />
      <div className="consistency__summary">
        <ProgressRing
          value={period.completed}
          max={period.completed + period.missed}
          size={96}
          stroke={9}
          tone="gradient"
          label={
            percent === null
              ? 'Not enough data yet'
              : `${percent}% completion: ${period.completed} done, ${period.missed} missed`
          }
        >
          <span className="consistency__percent">
            {percent === null ? '—' : <CountUp value={percent} />}
            {percent !== null && <span className="consistency__sign">%</span>}
          </span>
        </ProgressRing>
        <dl className="consistency__counts">
          <div className="count count--completed">
            <dt>Done</dt>
            <dd>{period.completed}</dd>
          </div>
          <div className="count count--missed">
            <dt>Missed</dt>
            <dd>{period.missed}</dd>
          </div>
          <div className="count count--skipped">
            <dt>Skipped</dt>
            <dd>{period.skipped}</dd>
          </div>
        </dl>
      </div>
      <p className="consistency__note">
        {percent === null
          ? 'Not enough data yet for this period.'
          : 'Skipped and unscheduled days don’t count against you.'}
      </p>
      <TrendChart trend={trend} />
    </section>
  );
}

function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

/** Twelve slim weekly bars. Weeks with nothing counted show as a faint stub. */
function TrendChart({ trend }: { trend: readonly WeekBar[] }) {
  const counted = trend.filter((w) => w.rate !== null);
  if (counted.length === 0) return null;
  const average = counted.reduce((sum, w) => sum + (w.rate ?? 0), 0) / counted.length;
  return (
    <figure className="trend-chart">
      <figcaption className="trend-chart__caption">
        Last {trend.length} weeks
        <span className="trend-chart__avg">avg {Math.round(average * 100)}%</span>
      </figcaption>
      <div
        className="trend-chart__bars"
        role="img"
        aria-label={`Weekly completion, oldest to newest: ${trend
          .map((w) => (w.rate === null ? 'no data' : `${Math.round(w.rate * 100)}%`))
          .join(', ')}`}
      >
        {trend.map((w, i) => (
          <span
            key={w.start}
            className={`trend-chart__bar${w.rate === null ? ' trend-chart__bar--empty' : ''}${i === trend.length - 1 ? ' trend-chart__bar--now' : ''}`}
            title={`Week of ${formatDateKey(w.start, undefined, { month: 'short', day: 'numeric' })}: ${w.rate === null ? 'no data' : `${Math.round(w.rate * 100)}%`}`}
          >
            <span
              style={{
                blockSize: `${w.rate === null ? 6 : Math.max(Math.round(w.rate * 100), 6)}%`,
              }}
            />
          </span>
        ))}
      </div>
      <div className="trend-chart__axis" aria-hidden="true">
        <span>
          {formatDateKey(trend[0]?.start ?? '', undefined, { month: 'short', day: 'numeric' })}
        </span>
        <span>This week</span>
      </div>
    </figure>
  );
}

/* ---------- History ---------- */

const HEAT_LABEL: Record<DayState, string> = {
  completed: 'done',
  skipped: 'skipped',
  missed: 'missed',
  pending: 'today, not logged yet',
  unscheduled: 'not scheduled',
  future: 'upcoming',
  outside: '',
};

/** Sixteen weeks as a grid of small squares, one per day, weeks as columns. */
export function HabitHeatmap({ days }: { days: readonly { date: string; state: DayState }[] }) {
  const done = days.filter((d) => d.state === 'completed').length;
  const missed = days.filter((d) => d.state === 'missed').length;
  const weeks = Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  return (
    <section className="detail-card heatmap" aria-labelledby="heatmap-title">
      <div className="detail-card__head">
        <h2 id="heatmap-title" className="detail-card__title">
          <CalendarHeart size={17} aria-hidden="true" /> History
        </h2>
        <span className="detail-card__meta">{weeks.length} weeks</span>
      </div>
      <div
        className="heatmap__grid"
        role="img"
        aria-label={`Last ${weeks.length} weeks: ${done} done, ${missed} missed`}
      >
        {weeks.map((week) => (
          <span key={week[0]?.date} className="heatmap__week">
            {week.map((d) => (
              <span
                key={d.date}
                className={`heatmap__day heatmap__day--${d.state}`}
                title={`${formatDateKey(d.date, undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${HEAT_LABEL[d.state]}`}
              />
            ))}
          </span>
        ))}
      </div>
      <ul className="heatmap__legend" aria-hidden="true">
        <li>
          <span className="heatmap__day heatmap__day--completed" /> Done
        </li>
        <li>
          <span className="heatmap__day heatmap__day--missed" /> Missed
        </li>
        <li>
          <span className="heatmap__day heatmap__day--skipped" /> Skipped
        </li>
        <li>
          <span className="heatmap__day heatmap__day--unscheduled" /> Off
        </li>
      </ul>
    </section>
  );
}

/* ---------- Insights ---------- */

interface InsightsProps {
  occurrences: readonly Occurrence[];
  entries: readonly HabitEntry[];
  weekly: boolean;
  today: string;
}

/** A few true observations from this habit's history. Only those with data are shown. */
export function HabitInsightList({ occurrences, entries, weekly, today }: InsightsProps) {
  const items: { icon: LucideIcon; text: ReactNode }[] = [];

  const best = weekly ? undefined : strongestWeekday(occurrences);
  if (best) {
    const name = formatDateKey(dateForWeekday(best.weekday), undefined, { weekday: 'long' });
    items.push({
      icon: CalendarHeart,
      text: (
        <>
          You’re most consistent on <em>{name}s</em> ({Math.round(best.rate * 100)}%).
        </>
      ),
    });
  }

  const minimums = entries.filter((e) => e.status === 'completed' && e.minimum).length;
  if (minimums > 0) {
    items.push({
      icon: Feather,
      text: (
        <>
          The minimum version saved the day <em>{minimums}</em> time{minimums === 1 ? '' : 's'}.
        </>
      ),
    });
  }

  const alternatives = entries.filter((e) => e.status === 'completed' && e.alternative).length;
  if (alternatives > 0) {
    items.push({
      icon: Shuffle,
      text: (
        <>
          An alternative counted <em>{alternatives}</em> time{alternatives === 1 ? '' : 's'}.
        </>
      ),
    });
  }

  const lastDone = [...entries]
    .filter((e) => e.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (lastDone) {
    items.push({
      icon: Clock3,
      text: (
        <>
          Last done{' '}
          {relativeDayLabel(lastDone.date, today) === inlineDayLabel(lastDone.date, today)
            ? `on ${inlineDayLabel(lastDone.date, today)}`
            : inlineDayLabel(lastDone.date, today)}
          .
        </>
      ),
    });
  }

  if (items.length === 0) return null;
  return (
    <section className="detail-card insights" aria-labelledby="insights-title">
      <div className="detail-card__head">
        <h2 id="insights-title" className="detail-card__title">
          <Lightbulb size={17} aria-hidden="true" /> Insights
        </h2>
      </div>
      <ul className="insights__list">
        {items.map(({ icon: Icon, text }, i) => (
          <li key={i} className="insights__item">
            <span className="insights__icon" aria-hidden="true">
              <Icon size={15} />
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Any date falling on `weekday` (0 = Sunday), for formatting its name. */
function dateForWeekday(weekday: number): string {
  // 2026-01-04 was a Sunday.
  const day = 4 + weekday;
  return `2026-01-${String(day).padStart(2, '0')}`;
}
