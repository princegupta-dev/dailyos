import { ChevronRight, Lightbulb, ListTodo, Plus, Sprout } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { LiveView } from '@/components/LiveView';
import { PageHero } from '@/components/PageHero';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { getRecentOccurrences, listHabitSummaries } from '@/db/repositories/habits';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { addDays, startOfWeek } from '@/lib/dates';
import { getRangeReport } from '@/services/analytics.service';
import { RecentLearning } from '../learning/RecentLearning';
import { TasksCard, TrendCard, WeekdayCard } from './InsightCharts';
import {
  AchievementsCard,
  ConsistencyCard,
  KpiGrid,
  ScoreHero,
  StreaksCard,
  SuggestionsCard,
} from './InsightCards';
import {
  achievements,
  headline,
  insightPeriod,
  momentumScore,
  suggestions,
  weekdayExtremes,
  weekdayPattern,
  type PeriodKind,
} from './insightsModel';

const PERIODS: readonly { value: PeriodKind; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: '90 days' },
];

const TREND_WEEKS = 12;
const RHYTHM_WEEKS = 8;

function isPeriodKind(value: string | null): value is PeriodKind {
  return PERIODS.some((p) => p.value === value);
}

/** Patterns from what you recorded: how it's going, what's changing, and what to try next. */
export function InsightsPage() {
  const today = useToday();
  const weekStartsOn = useWeekStartsOn();
  const [params, setParams] = useSearchParams();
  const raw = params.get('period');
  const kind: PeriodKind = isPeriodKind(raw) ? raw : 'week';
  const period = useMemo(
    () => insightPeriod(kind, today, weekStartsOn),
    [kind, today, weekStartsOn],
  );

  const data = useLiveData(
    useCallback(async () => {
      const trendFrom = addDays(startOfWeek(today, weekStartsOn), -7 * (TREND_WEEKS - 1));
      const [current, previous, trend, summaries, occurrences] = await Promise.all([
        getRangeReport(period.from, period.to, today, weekStartsOn, false),
        getRangeReport(period.prevFrom, period.prevTo, today, weekStartsOn, false),
        getRangeReport(trendFrom, today, today, weekStartsOn, true),
        listHabitSummaries(today, weekStartsOn),
        getRecentOccurrences(today, weekStartsOn, RHYTHM_WEEKS * 7),
      ]);
      return {
        current: current.summary,
        previous: previous.summary,
        weeks: trend.weeks ?? [],
        summaries,
        occurrences,
      };
    }, [period, today, weekStartsOn]),
  );

  return (
    <div className="insights-page">
      <PageHero
        eyebrow="Your patterns"
        title="Insights"
        subtitle={
          <>
            What’s working, what’s changing, and <em>one next step</em>.
          </>
        }
      />

      <div className="insights-page__filters">
        <SegmentedControl
          label="Period"
          value={kind}
          options={PERIODS}
          onChange={(value) => {
            setParams(
              (current) => {
                const next = new URLSearchParams(current);
                if (value === 'week') next.delete('period');
                else next.set('period', value);
                return next;
              },
              { replace: true },
            );
          }}
        />
        <p className="insights-page__compare">Compared with {period.prevName}</p>
      </div>

      <LiveView state={data} loadingLabel="Loading insights…" skeleton={<InsightsSkeleton />}>
        {({ current, previous, weeks, summaries, occurrences }) => {
          const habits = summaries.map((s) => s.habit);
          const empty =
            summaries.length === 0 &&
            weeks.every((w) => w.tasksCompleted === 0 && w.plan.planned === 0);
          if (empty) return <InsightsEmpty />;

          const pattern = weekdayPattern(occurrences, habits, weekStartsOn);
          const extremes = weekdayExtremes(pattern);
          return (
            <div className="insights-grid">
              <div className="insights-grid__main">
                <ScoreHero
                  score={momentumScore(current)}
                  previousScore={momentumScore(previous)}
                  current={current}
                  previous={previous}
                  period={period}
                  story={headline(current, previous, period)}
                />
                <TrendCard key={weeks.at(-1)?.from} weeks={weeks} />
                <ConsistencyCard
                  current={current}
                  previous={previous}
                  summaries={summaries}
                  period={period}
                />
                <StreaksCard summaries={summaries} />
              </div>
              <div className="insights-grid__side">
                <KpiGrid current={current} previous={previous} period={period} />
                <SuggestionsCard
                  items={suggestions({ current, previous, period, habits, extremes })}
                />
                <WeekdayCard pattern={pattern} weeks={RHYTHM_WEEKS} />
                <TasksCard summary={current} name={period.name} />
                <AchievementsCard items={achievements(summaries.map((s) => s.stats))} />
              </div>
            </div>
          );
        }}
      </LiveView>

      <div className="insights-page__more">
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
      </div>
    </div>
  );
}

/** Before there's anything to measure: what will appear here, and how to start. */
function InsightsEmpty() {
  return (
    <section className="insights-empty" aria-labelledby="insights-empty-title">
      <span className="insights-empty__art" aria-hidden="true">
        <Sprout size={30} />
      </span>
      <h2 id="insights-empty-title" className="insights-empty__title">
        Insights grow as you go
      </h2>
      <p className="insights-empty__text">
        Check in on a habit or plan a few tasks. After a few days you’ll see your momentum, your
        best days of the week, streaks, and kind suggestions here.
      </p>
      <Link to="/habits/new" className="hero-cta insights-empty__cta">
        <Plus size={18} aria-hidden="true" />
        Create a habit
      </Link>
    </section>
  );
}

function InsightsSkeleton() {
  return (
    <div className="insights-grid">
      <div className="insights-grid__main">
        <div className="skeleton skeleton--card" style={{ height: 220 }} />
        <div className="skeleton skeleton--card" style={{ height: 260 }} />
      </div>
      <div className="insights-grid__side">
        <div className="skeleton skeleton--card" style={{ height: 200 }} />
        <div className="skeleton skeleton--card" style={{ height: 180 }} />
      </div>
    </div>
  );
}
