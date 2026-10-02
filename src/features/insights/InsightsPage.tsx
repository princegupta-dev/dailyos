import { ChevronRight, Flame, Lightbulb, ListTodo } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router';
import { CategoryIcon } from '@/components/CategoryIcon';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { listHabitSummaries } from '@/db/repositories/habits';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { startOfWeek } from '@/lib/dates';
import { getRangeReport } from '@/services/analytics.service';
import { RecentLearning } from '../learning/RecentLearning';
import { percent } from '../reviews/format';

/** Patterns from what you recorded, plus the way into notes and tasks. */
export function InsightsPage() {
  const today = useToday();
  const weekStartsOn = useWeekStartsOn();
  const weekStart = startOfWeek(today, weekStartsOn);
  const week = useLiveData(
    useCallback(
      () => getRangeReport(weekStart, today, today, weekStartsOn, false),
      [weekStart, today, weekStartsOn],
    ),
  );
  const summaries = useLiveData(
    useCallback(() => listHabitSummaries(today, weekStartsOn), [today, weekStartsOn]),
  );

  return (
    <>
      <PageHeader title="Insights" description="Patterns from what you’ve recorded." />

      <Section
        title="This week"
        meta={week.status === 'ready' ? percent(week.data.summary.habits.overall.rate) : undefined}
      >
        <LiveView state={week}>
          {({ summary }) =>
            summary.habits.perHabit.length === 0 ? (
              <p className="muted small">No habit occurrences yet this week.</p>
            ) : (
              <ul className="result-list">
                {summary.habits.perHabit.map(({ habitId, name, summary: s }) => (
                  <li key={habitId} className="result-list__item">
                    <Link to={`/habits/${habitId}`}>{name}</Link>
                    <span className="muted small">
                      {s.completed} of {s.completed + s.missed}
                      {s.skipped > 0 ? ` · ${s.skipped} skipped` : ''}
                      {s.pending > 0 ? ` · ${s.pending} to go` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </LiveView>
      </Section>

      <Section title="Streaks">
        <LiveView state={summaries}>
          {(items) => {
            const ranked = items
              .filter((s) => s.stats.totalCompletions > 0)
              .sort(
                (a, b) =>
                  b.stats.currentStreak - a.stats.currentStreak ||
                  b.stats.longestStreak - a.stats.longestStreak,
              );
            return ranked.length === 0 ? (
              <p className="muted small">Streaks appear once you complete a habit.</p>
            ) : (
              <ul className="habit-list">
                {ranked.map(({ habit, stats }) => (
                  <li key={habit.id} className="habit-row">
                    <CategoryIcon category={habit.category} size="sm" />
                    <Link to={`/habits/${habit.id}`} className="habit-row__body">
                      <span className="habit-row__name">{habit.name}</span>
                      <span className="habit-row__meta">
                        Longest {stats.longestStreak} · {stats.totalCompletions} total
                      </span>
                    </Link>
                    <span
                      className="streak-badge"
                      aria-label={`Current streak ${stats.currentStreak}`}
                    >
                      <Flame size={14} aria-hidden="true" />
                      {stats.currentStreak}
                    </span>
                  </li>
                ))}
              </ul>
            );
          }}
        </LiveView>
      </Section>

      <RecentLearning today={today} />

      <Section title="More">
        <ul className="nav-list">
          <li>
            <Link to="/learn" className="nav-list__link">
              <span className="nav-list__with-icon">
                <Lightbulb size={18} aria-hidden="true" />
                <span>
                  <span className="nav-list__label">Notes and learning</span>
                  <span className="nav-list__meta">Search, topics, review dates</span>
                </span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>
          <li>
            <Link to="/tasks" className="nav-list__link">
              <span className="nav-list__with-icon">
                <ListTodo size={18} aria-hidden="true" />
                <span>
                  <span className="nav-list__label">Tasks</span>
                  <span className="nav-list__meta">Inbox, active, done, and history</span>
                </span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </Section>
    </>
  );
}
