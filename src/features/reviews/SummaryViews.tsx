import {
  BookOpen,
  CalendarRange,
  Check,
  CircleCheckBig,
  Flag,
  GraduationCap,
  ListChecks,
  Repeat,
  Smile,
  Target,
  TrendingUp,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ProgressRing } from '@/components/ProgressRing';
import { Section } from '@/components/Section';
import type { DailySummary, RangeReport, RangeSummary } from '@/services/analytics.service';
import { formatDateKey } from '@/lib/dates';
import { percent, plural } from './format';
import { RatingPips } from './RatingPips';

/**
 * The day at a glance. Each habit and task is listed with its status in the reflections
 * below (see ItemReflections), so this keeps to the totals.
 */
export function DailySummaryView({ summary }: { summary: DailySummary }) {
  const { counts, habitSummary } = summary;
  const habitsCounted = summary.habits.length - habitSummary.skipped;
  const tasksTotal = counts.done + counts.notDone + counts.open;
  return (
    <div className="summary">
      {summary.intention && (
        <blockquote className="intention-quote">
          <p className="intention-quote__label">Today’s intention</p>
          <p className="intention-quote__text">{summary.intention}</p>
        </blockquote>
      )}

      <Section
        title="Planned vs. actual"
        icon={Target}
        className="section--glance"
        meta={counts.planned > 0 ? percent(counts.completionRate) : undefined}
      >
        <div className="day-glance">
          {(counts.planned > 0 || summary.habits.length > 0) && (
            <div className="day-glance__rings">
              {counts.planned > 0 && (
                <GlanceRing
                  label="Tasks"
                  value={counts.done}
                  max={tasksTotal}
                  description={`Tasks: ${counts.done} of ${tasksTotal} done`}
                />
              )}
              {summary.habits.length > 0 && (
                <GlanceRing
                  label="Habits"
                  value={habitSummary.completed}
                  max={habitsCounted}
                  description={`Habits: ${habitSummary.completed} of ${habitsCounted} done`}
                />
              )}
            </div>
          )}
          <div className="day-glance__lines">
            {counts.planned === 0 ? (
              <p className="day-glance__line day-glance__line--muted">
                No tasks were planned for this day.
              </p>
            ) : (
              <p className="day-glance__line">
                {counts.done} of {counts.done + counts.notDone + counts.open} planned tasks done
                {counts.rescheduled > 0 ? ` · ${counts.rescheduled} rescheduled` : ''}
                {counts.cancelled > 0 ? ` · ${counts.cancelled} cancelled` : ''}
              </p>
            )}
            {summary.unplannedCompleted.length > 0 && (
              <p className="day-glance__line">
                {plural(summary.unplannedCompleted.length, 'unplanned task')} also done
              </p>
            )}
            {summary.habits.length > 0 && (
              <p className="day-glance__line">
                {habitSummary.completed} of {habitsCounted} habits done
                {habitSummary.skipped > 0 ? ` · ${habitSummary.skipped} skipped` : ''}
              </p>
            )}
          </div>
        </div>
      </Section>

      {summary.outcomes.length > 0 && (
        <Section
          title="Top outcomes"
          icon={Flag}
          meta={`${summary.outcomes.filter((o) => o.done).length} of ${summary.outcomes.length}`}
        >
          <ul className="outcome-results">
            {summary.outcomes.map((o) => (
              <li
                key={o.id}
                className={`outcome-results__item outcome-results__item--${o.done ? 'done' : 'not-done'}`}
              >
                <span className="outcome-results__mark">
                  {o.done ? (
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <X size={14} strokeWidth={3} aria-hidden="true" />
                  )}
                  <span className="visually-hidden">{o.done ? 'Achieved:' : 'Not achieved:'}</span>
                </span>
                <span>{o.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.learning.length > 0 && (
        <Section
          title="Learned"
          icon={GraduationCap}
          meta={plural(summary.learning.length, 'note')}
        >
          <ul className="learned-list">
            {summary.learning.map((l) => (
              <li key={l.id} className="learned-list__item">
                <BookOpen size={15} aria-hidden="true" />
                <Link to={`/learn/${l.id}`}>{l.title}</Link>
                {l.topic && <span className="tag">{l.topic}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function GlanceRing({
  label,
  value,
  max,
  description,
}: {
  label: string;
  value: number;
  max: number;
  description: string;
}) {
  return (
    <div className="glance-ring">
      <ProgressRing
        value={value}
        max={max}
        size={76}
        stroke={8}
        tone="gradient"
        label={description}
      >
        <span className="glance-ring__value">
          {value}
          <span className="glance-ring__of">/{max}</span>
        </span>
      </ProgressRing>
      <span className="glance-ring__label" aria-hidden="true">
        {label}
      </span>
    </div>
  );
}

/* ---------- Weeks and months ---------- */

function Metric({
  icon: Icon,
  label,
  value,
  rate,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  /** 0–1, drawn as a slim bar under the value. */
  rate?: number | null;
  children?: ReactNode;
}) {
  return (
    <div className="metric">
      <dt className="metric__label">
        <span className="metric__icon" aria-hidden="true">
          <Icon size={14} />
        </span>
        {label}
      </dt>
      <dd className="metric__value">{value}</dd>
      {rate !== undefined && (
        <dd className="metric__bar" aria-hidden="true">
          <span style={{ inlineSize: `${Math.round((rate ?? 0) * 100)}%` }} />
        </dd>
      )}
      {children}
    </div>
  );
}

function StatTiles({ summary }: { summary: RangeSummary }) {
  const avg = summary.ratings.average;
  return (
    <dl className="metrics">
      <Metric icon={CircleCheckBig} label="Tasks done" value={summary.tasksCompleted} />
      <Metric
        icon={ListChecks}
        label="Plan kept"
        value={percent(summary.plan.completionRate)}
        rate={summary.plan.completionRate}
      />
      <Metric
        icon={Repeat}
        label="Habits"
        value={percent(summary.habits.overall.rate)}
        rate={summary.habits.overall.rate}
      />
      <Metric icon={Smile} label="Avg. day" value={avg === null ? '—' : `${avg.toFixed(1)}/5`}>
        {avg !== null && (
          <dd className="metric__pips">
            <RatingPips rating={Math.round(avg * 2) / 2} showValue={false} />
          </dd>
        )}
      </Metric>
    </dl>
  );
}

export function RangeSummaryView({ report }: { report: RangeReport; today: string }) {
  const { summary, weeks } = report;
  const short = { weekday: 'short', month: 'short', day: 'numeric' } as const;
  return (
    <div className="summary">
      <StatTiles summary={summary} />
      <p className="stat-note">
        “Plan kept” counts planned tasks finished on their day; rescheduled and cancelled ones are
        left out. Skipped habits don’t count against you.
      </p>

      {summary.habits.perHabit.length > 0 && (
        <Section title="Habit consistency" icon={TrendingUp}>
          <ul className="consistency-bars">
            {summary.habits.perHabit.map(({ habitId, name, summary: s }) => (
              <li key={habitId} className="consistency-bars__item">
                <span className="consistency-bars__head">
                  <span className="consistency-bars__name">{name}</span>
                  <span className="consistency-bars__value">
                    {percent(s.rate)} · {s.completed} of {s.completed + s.missed}
                    {s.skipped > 0 ? ` · ${s.skipped} skipped` : ''}
                  </span>
                </span>
                <span
                  className={`consistency-bars__track${s.rate !== null && s.rate >= 0.8 ? ' consistency-bars__track--strong' : ''}`}
                  aria-hidden="true"
                >
                  <span style={{ inlineSize: `${Math.round((s.rate ?? 0) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.outcomes.set > 0 && (
        <Section
          title="Top outcomes"
          icon={Flag}
          meta={`${summary.outcomes.done} of ${summary.outcomes.set} achieved`}
        >
          <progress
            className="progress progress--outcomes"
            max={summary.outcomes.set}
            value={summary.outcomes.done}
            aria-label={`${summary.outcomes.done} of ${summary.outcomes.set} top outcomes achieved`}
          />
        </Section>
      )}

      <Section title="Learning" icon={GraduationCap} meta={plural(summary.learning.count, 'note')}>
        {summary.learning.topics.length === 0 ? (
          <p className="quiet-note">
            {summary.learning.count === 0
              ? 'Nothing captured in this period.'
              : 'No topics tagged.'}
          </p>
        ) : (
          <ul className="chip-list">
            {summary.learning.topics.map((t) => (
              <li key={t.topic} className="tag tag--large">
                {t.topic} · {t.count}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Blockers" icon={TriangleAlert}>
        {summary.blockers.length === 0 ? (
          <p className="quiet-note">No blockers recorded in daily reviews or reschedule notes.</p>
        ) : (
          <ul className="blocker-list">
            {summary.blockers.map((b) => (
              <li
                key={b.text}
                className={`blocker-list__item${b.dates.length > 1 ? ' blocker-list__item--repeat' : ''}`}
              >
                <span className="blocker-list__text">{b.text}</span>
                <span className="blocker-list__meta">
                  {b.dates.length > 1 && (
                    <span className="blocker-list__count">{b.dates.length}×</span>
                  )}
                  {b.dates.map((d) => formatDateKey(d, undefined, short)).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {weeks && weeks.length > 0 && (
        <Section title="Week by week" icon={CalendarRange}>
          <WeekBars weeks={weeks} />
          <div className="table-scroll">
            <table className="trend-table">
              <caption className="visually-hidden">Weekly trend for this month</caption>
              <thead>
                <tr>
                  <th scope="col">Week</th>
                  <th scope="col">Tasks</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Habits</th>
                  <th scope="col">Day</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.from}>
                    <th scope="row">
                      {formatDateKey(w.from, undefined, { month: 'short', day: 'numeric' })}
                    </th>
                    <td>{w.tasksCompleted}</td>
                    <td>{percent(w.plan.completionRate)}</td>
                    <td>{percent(w.habits.overall.rate)}</td>
                    <td>{w.ratings.average === null ? '—' : w.ratings.average.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

/** Habit consistency and plan kept for each week of a month, side by side. Decorative: the
 * table below carries the same numbers. */
function WeekBars({ weeks }: { weeks: readonly RangeSummary[] }) {
  return (
    <div className="week-bars" aria-hidden="true">
      <div className="week-bars__chart">
        {weeks.map((w) => (
          <div key={w.from} className="week-bars__week">
            <div className="week-bars__pair">
              <span
                className="week-bars__bar week-bars__bar--habits"
                style={{
                  blockSize: `${Math.max(Math.round((w.habits.overall.rate ?? 0) * 100), 3)}%`,
                }}
              />
              <span
                className="week-bars__bar week-bars__bar--plan"
                style={{
                  blockSize: `${Math.max(Math.round((w.plan.completionRate ?? 0) * 100), 3)}%`,
                }}
              />
            </div>
            <span className="week-bars__label">
              {formatDateKey(w.from, undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
      <p className="week-bars__legend">
        <span className="week-bars__key week-bars__key--habits" /> Habits
        <span className="week-bars__key week-bars__key--plan" /> Plan kept
      </p>
    </div>
  );
}
