import { ArrowRight, CalendarRange, ListChecks, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Section } from '@/components/Section';
import { formatDateKey } from '@/lib/dates';
import type { PlanCounts, RangeSummary } from '@/services/analytics.service';
import { formatRating, percent } from '../reviews/format';
import { planRate, weekdayExtremes, type WeekdayRate } from './insightsModel';

const short = { month: 'short', day: 'numeric' } as const;

/* ---------- Twelve-week trend ---------- */

/**
 * Habit consistency and plan kept for each of the last twelve weeks. Each week is a button:
 * choosing one shows its numbers below, with a way into that week's review.
 */
export function TrendCard({ weeks }: { weeks: readonly RangeSummary[] }) {
  const [selected, setSelected] = useState(weeks.length - 1);
  const week = weeks[selected] ?? weeks.at(-1);
  const rated = weeks.filter((w) => w.habits.overall.rate !== null);
  const average =
    rated.length === 0
      ? null
      : rated.reduce((sum, w) => sum + (w.habits.overall.rate ?? 0), 0) / rated.length;

  return (
    <Section
      title="Trend"
      icon={CalendarRange}
      description={`The last ${weeks.length} weeks. Choose a week for details.`}
      className="insights-card insights-trend"
    >
      <div className="trend">
        <div className="trend__plot">
          {average !== null && (
            <span
              className="trend__average"
              style={{ insetBlockEnd: `${Math.round(average * 100)}%` }}
              aria-hidden="true"
            >
              <span>avg {percent(average)}</span>
            </span>
          )}
          <div className="trend__weeks" role="group" aria-label="Weeks">
            {weeks.map((w, i) => {
              const habits = w.habits.overall.rate;
              const plan = planRate(w);
              const label = `Week of ${formatDateKey(w.from, undefined, short)}: habits ${percent(habits)}, plan kept ${percent(plan)}`;
              return (
                <button
                  key={w.from}
                  type="button"
                  className="trend__week"
                  aria-pressed={i === selected}
                  aria-label={label}
                  title={label}
                  onClick={() => {
                    setSelected(i);
                  }}
                >
                  <span className="trend__bars" aria-hidden="true">
                    <span
                      className={`trend__bar trend__bar--habits${habits === null ? ' trend__bar--empty' : ''}`}
                      style={{ blockSize: `${habits === null ? 4 : Math.max(habits * 100, 4)}%` }}
                    />
                    <span
                      className={`trend__bar trend__bar--plan${plan === null ? ' trend__bar--empty' : ''}`}
                      style={{ blockSize: `${plan === null ? 4 : Math.max(plan * 100, 4)}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="trend__axis" aria-hidden="true">
          <span>{weeks[0] ? formatDateKey(weeks[0].from, undefined, short) : ''}</span>
          <span>This week</span>
        </div>
        <p className="trend__legend" aria-hidden="true">
          <span className="trend__key trend__key--habits" /> Habits
          <span className="trend__key trend__key--plan" /> Plan kept
        </p>
      </div>

      {week && (
        <div className="trend-detail" aria-live="polite">
          <p className="trend-detail__title">
            Week of {formatDateKey(week.from, undefined, short)}
            {selected === weeks.length - 1 && <span className="trend-detail__now">This week</span>}
          </p>
          <dl className="trend-detail__stats">
            <div>
              <dt>Habits</dt>
              <dd>{percent(week.habits.overall.rate)}</dd>
            </div>
            <div>
              <dt>Plan kept</dt>
              <dd>{percent(planRate(week))}</dd>
            </div>
            <div>
              <dt>Tasks done</dt>
              <dd>{week.tasksCompleted}</dd>
            </div>
            <div>
              <dt>Avg. day</dt>
              <dd>
                {week.ratings.average === null
                  ? '—'
                  : `${formatRating(Math.round(week.ratings.average * 10) / 10)}/5`}
              </dd>
            </div>
          </dl>
          <Link to={`/review/weekly/${week.from}`} className="trend-detail__link">
            Open weekly review <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </Section>
  );
}

/* ---------- Weekday rhythm ---------- */

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Habit follow-through by day of the week, with the best and hardest days called out. */
export function WeekdayCard({
  pattern,
  weeks,
}: {
  pattern: readonly WeekdayRate[];
  weeks: number;
}) {
  const extremes = weekdayExtremes(pattern);
  const hasData = pattern.some((d) => d.counted > 0);
  return (
    <Section
      title="Your rhythm"
      icon={Sun}
      description={`Habits by day of the week, last ${weeks} weeks.`}
      className="insights-card insights-weekday"
    >
      {!hasData ? (
        <p className="quiet-note">Your rhythm appears after a week or two of check-ins.</p>
      ) : (
        <>
          <div
            className="weekday-chart"
            role="img"
            aria-label={pattern
              .map((d) => `${WEEKDAY_LONG[d.weekday] ?? ''} ${percent(d.rate)}`)
              .join(', ')}
          >
            {pattern.map((d) => {
              const best = extremes?.best.weekday === d.weekday;
              const worst = extremes?.worst.weekday === d.weekday;
              return (
                <div
                  key={d.weekday}
                  className={`weekday-chart__day${best ? ' weekday-chart__day--best' : ''}${worst ? ' weekday-chart__day--worst' : ''}`}
                >
                  <span className="weekday-chart__value">
                    {d.rate === null ? '' : percent(d.rate)}
                  </span>
                  <span className="weekday-chart__track">
                    <span
                      style={{ blockSize: `${d.rate === null ? 0 : Math.max(d.rate * 100, 4)}%` }}
                    />
                  </span>
                  <span className="weekday-chart__label">{WEEKDAY_SHORT[d.weekday]}</span>
                </div>
              );
            })}
          </div>
          {extremes && (
            <p className="insights-note">
              Strongest on <em>{WEEKDAY_LONG[extremes.best.weekday]}s</em>; hardest on{' '}
              <em>{WEEKDAY_LONG[extremes.worst.weekday]}s</em>.
            </p>
          )}
        </>
      )}
    </Section>
  );
}

/* ---------- Tasks ---------- */

const SEGMENTS = [
  { key: 'done', label: 'Done' },
  { key: 'notDone', label: 'Not done' },
  { key: 'open', label: 'Still open' },
  { key: 'rescheduled', label: 'Moved' },
  { key: 'cancelled', label: 'Cancelled' },
] as const satisfies readonly { key: keyof PlanCounts; label: string }[];

/** What happened to planned tasks, as one stacked bar, plus finished tasks and outcomes. */
export function TasksCard({ summary, name }: { summary: RangeSummary; name: string }) {
  const { plan } = summary;
  const parts = SEGMENTS.map((s) => ({ ...s, value: plan[s.key] })).filter((s) => s.value > 0);
  return (
    <Section
      title="Tasks"
      icon={ListChecks}
      meta={planRate(summary) !== null ? `${percent(planRate(summary))} kept` : undefined}
      className="insights-card insights-tasks"
    >
      <div className="task-insight">
        <p className="task-insight__lead">
          <strong>{summary.tasksCompleted}</strong> finished {name}
          {summary.outcomes.set > 0 && (
            <span className="task-insight__outcomes">
              {summary.outcomes.done} of {summary.outcomes.set} top outcomes achieved
            </span>
          )}
        </p>
        {plan.planned === 0 ? (
          <p className="quiet-note">No tasks planned {name}. Planning on Today shows here.</p>
        ) : (
          <>
            <div
              className="task-insight__bar"
              role="img"
              aria-label={`${plan.planned} planned: ${parts.map((p) => `${p.value} ${p.label.toLowerCase()}`).join(', ')}`}
            >
              {parts.map((p) => (
                <span
                  key={p.key}
                  className={`task-insight__segment task-insight__segment--${p.key}`}
                  style={{ flexGrow: p.value }}
                />
              ))}
            </div>
            <ul className="task-insight__legend" aria-hidden="true">
              {parts.map((p) => (
                <li key={p.key}>
                  <span className={`task-insight__key task-insight__segment--${p.key}`} />
                  {p.label} <strong>{p.value}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Section>
  );
}
