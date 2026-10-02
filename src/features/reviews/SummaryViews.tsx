import { Check, CircleDashed, Minus, X } from 'lucide-react';
import { Link } from 'react-router';
import { Section } from '@/components/Section';
import type { OccurrenceStatus } from '@/domain/habit';
import { OUTCOME_LABELS, type PlanItemOutcome } from '@/domain/plan';
import type { DailySummary, RangeReport, RangeSummary } from '@/services/analytics.service';
import { formatDateKey } from '@/lib/dates';
import { inlineDayLabel } from '@/lib/format';
import { percent, plural } from './format';

const OUTCOME_ICON: Record<PlanItemOutcome, typeof Check> = {
  done: Check,
  not_done: X,
  open: CircleDashed,
  rescheduled: Minus,
  cancelled: Minus,
};

const HABIT_TEXT: Record<OccurrenceStatus, string> = {
  completed: 'Done',
  skipped: 'Skipped',
  missed: 'Missed',
  pending: 'Not yet',
};

export function DailySummaryView({ summary, today }: { summary: DailySummary; today: string }) {
  const { counts } = summary;
  return (
    <div className="summary">
      {summary.intention && (
        <blockquote className="summary__intention">{summary.intention}</blockquote>
      )}

      <Section
        title="Planned vs. actual"
        meta={counts.planned > 0 ? percent(counts.completionRate) : undefined}
      >
        {counts.planned === 0 ? (
          <p className="muted small">No tasks were planned for this day.</p>
        ) : (
          <>
            <p className="small">
              {counts.done} of {counts.done + counts.notDone + counts.open} planned tasks done
              {counts.rescheduled > 0 ? ` · ${counts.rescheduled} rescheduled` : ''}
              {counts.cancelled > 0 ? ` · ${counts.cancelled} cancelled` : ''}
            </p>
            <ul className="result-list">
              {summary.planned.map((p) => {
                const Icon = OUTCOME_ICON[p.outcome];
                return (
                  <li
                    key={p.taskId}
                    className={`result-list__item result-list__item--${p.outcome}`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <Link to={`/tasks/${p.taskId}`}>{p.title}</Link>
                    <span className="muted small">
                      {OUTCOME_LABELS[p.outcome]}
                      {p.rescheduledTo ? ` to ${inlineDayLabel(p.rescheduledTo, today)}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {summary.unplannedCompleted.length > 0 && (
          <div className="subsection">
            <h3 className="subsection__title">Also completed</h3>
            <ul className="result-list">
              {summary.unplannedCompleted.map((t) => (
                <li key={t.taskId} className="result-list__item result-list__item--done">
                  <Check size={16} aria-hidden="true" />
                  <Link to={`/tasks/${t.taskId}`}>{t.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {summary.outcomes.length > 0 && (
        <Section
          title="Top outcomes"
          meta={`${summary.outcomes.filter((o) => o.done).length} of ${summary.outcomes.length}`}
        >
          <ul className="result-list">
            {summary.outcomes.map((o) => (
              <li
                key={o.id}
                className={`result-list__item result-list__item--${o.done ? 'done' : 'not_done'}`}
              >
                {o.done ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <X size={16} aria-hidden="true" />
                )}
                <span>{o.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.habits.length > 0 && (
        <Section
          title="Habits"
          meta={`${summary.habitSummary.completed} of ${summary.habits.length - summary.habitSummary.skipped}`}
        >
          <ul className="result-list">
            {summary.habits.map((h) => (
              <li
                key={h.habitId}
                className={`result-list__item result-list__item--habit-${h.status}`}
              >
                <span>{h.name}</span>
                <span className="muted small">
                  {HABIT_TEXT[h.status]}
                  {h.weekly ? ' this week' : ''}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.learning.length > 0 && (
        <Section title="Learned" meta={plural(summary.learning.length, 'note')}>
          <ul className="result-list">
            {summary.learning.map((l) => (
              <li key={l.id} className="result-list__item">
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

function StatTiles({ summary }: { summary: RangeSummary }) {
  return (
    <dl className="stat-row stat-row--four">
      <div className="stat">
        <dt>Tasks done</dt>
        <dd>{summary.tasksCompleted}</dd>
      </div>
      <div className="stat">
        <dt>Plan kept</dt>
        <dd>{percent(summary.plan.completionRate)}</dd>
      </div>
      <div className="stat">
        <dt>Habits</dt>
        <dd>{percent(summary.habits.overall.rate)}</dd>
      </div>
      <div className="stat">
        <dt>Avg. day</dt>
        <dd>
          {summary.ratings.average === null ? '—' : `${summary.ratings.average.toFixed(1)}/5`}
        </dd>
      </div>
    </dl>
  );
}

export function RangeSummaryView({ report, today }: { report: RangeReport; today: string }) {
  const { summary, weeks } = report;
  return (
    <div className="summary">
      <StatTiles summary={summary} />
      <p className="muted small stat-note">
        “Plan kept” counts planned tasks finished on their day; rescheduled and cancelled ones are
        left out. Skipped habits don’t count against you.
      </p>

      {summary.habits.perHabit.length > 0 && (
        <Section title="Habit consistency">
          <ul className="result-list">
            {summary.habits.perHabit.map(({ habitId, name, summary: s }) => (
              <li key={habitId} className="result-list__item">
                <span>{name}</span>
                <span className="muted small">
                  {percent(s.rate)} · {s.completed} of {s.completed + s.missed}
                  {s.skipped > 0 ? ` · ${s.skipped} skipped` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Learning" meta={plural(summary.learning.count, 'note')}>
        {summary.learning.topics.length === 0 ? (
          <p className="muted small">
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

      {summary.outcomes.set > 0 && (
        <Section
          title="Top outcomes"
          meta={`${summary.outcomes.done} of ${summary.outcomes.set} achieved`}
        >
          <progress
            className="progress"
            max={summary.outcomes.set}
            value={summary.outcomes.done}
            aria-label={`${summary.outcomes.done} of ${summary.outcomes.set} top outcomes achieved`}
          />
        </Section>
      )}

      <Section title="Blockers">
        {summary.blockers.length === 0 ? (
          <p className="muted small">No blockers recorded in daily reviews or reschedule notes.</p>
        ) : (
          <ul className="result-list">
            {summary.blockers.map((b) => (
              <li key={b.text} className="result-list__item">
                <span>{b.text}</span>
                <span className="muted small">
                  {b.dates.length > 1 ? `${b.dates.length}× · ` : ''}
                  {b.dates
                    .map((d) =>
                      formatDateKey(d, undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      }),
                    )
                    .join(', ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {weeks && weeks.length > 0 && (
        <Section title="Week by week">
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
      {today < summary.to && <p className="muted small">This period is still in progress.</p>}
    </div>
  );
}
