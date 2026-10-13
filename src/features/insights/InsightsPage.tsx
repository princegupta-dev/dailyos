import { ChevronRight, Lightbulb, ListTodo, Plus, Sprout, Wallet } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { LiveView } from '@/components/LiveView';
import { PageHero } from '@/components/PageHero';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { getFinanceData } from '@/db/repositories/finance';
import { getRecentOccurrences, listHabitSummaries } from '@/db/repositories/habits';
import { useLiveData } from '@/hooks/useLiveData';
import { useSettings, useToday, useWeekStartsOn } from '@/hooks/useToday';
import { addDays, startOfWeek } from '@/lib/dates';
import { getRangeReport } from '@/services/analytics.service';
import { isFinanceEmpty } from '@/services/finance.service';
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
import { HabitsMoneyCard, MoneyKpis, SpendingPatternCard } from './MoneyInsightCards';
import { habitsAndMoney, moneyPeriod, moneySuggestions } from './moneyInsights';

const PERIODS: readonly { value: PeriodKind; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: '90 days' },
];

const TREND_WEEKS = 12;
const RHYTHM_WEEKS = 8;

type View = 'all' | 'habits' | 'money';

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'all', label: 'Both' },
  { value: 'habits', label: 'Habits' },
  { value: 'money', label: 'Money' },
];

function isPeriodKind(value: string | null): value is PeriodKind {
  return PERIODS.some((p) => p.value === value);
}

function isView(value: string | null): value is View {
  return VIEWS.some((v) => v.value === value);
}

/**
 * Patterns from what you recorded, across both trackers: habits, money, or both together.
 * How it's going, what's changing, and what to try next.
 */
export function InsightsPage() {
  const today = useToday();
  const weekStartsOn = useWeekStartsOn();
  const [params, setParams] = useSearchParams();
  const raw = params.get('period');
  const kind: PeriodKind = isPeriodKind(raw) ? raw : 'week';
  const rawView = params.get('view');
  const view: View = isView(rawView) ? rawView : 'all';
  const settings = useSettings();
  const period = useMemo(
    () => insightPeriod(kind, today, weekStartsOn),
    [kind, today, weekStartsOn],
  );

  const data = useLiveData(
    useCallback(async () => {
      const trendFrom = addDays(startOfWeek(today, weekStartsOn), -7 * (TREND_WEEKS - 1));
      const [current, previous, trend, summaries, occurrences, finance] = await Promise.all([
        getRangeReport(period.from, period.to, today, weekStartsOn, false),
        getRangeReport(period.prevFrom, period.prevTo, today, weekStartsOn, false),
        getRangeReport(trendFrom, today, today, weekStartsOn, true),
        listHabitSummaries(today, weekStartsOn),
        getRecentOccurrences(today, weekStartsOn, RHYTHM_WEEKS * 7),
        getFinanceData(),
      ]);
      return {
        current: current.summary,
        previous: previous.summary,
        weeks: trend.weeks ?? [],
        summaries,
        occurrences,
        finance,
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
        <SegmentedControl
          label="Show"
          value={view}
          options={VIEWS}
          onChange={(value) => {
            setParams(
              (current) => {
                const next = new URLSearchParams(current);
                if (value === 'all') next.delete('view');
                else next.set('view', value);
                return next;
              },
              { replace: true },
            );
          }}
        />
        <p className="insights-page__compare">Compared with {period.prevName}</p>
      </div>

      <LiveView state={data} loadingLabel="Loading insights…" skeleton={<InsightsSkeleton />}>
        {({ current, previous, weeks, summaries, occurrences, finance }) => {
          const habits = summaries.map((s) => s.habit);
          const habitsEmpty =
            summaries.length === 0 &&
            weeks.every((w) => w.tasksCompleted === 0 && w.plan.planned === 0);
          const moneyEmpty = isFinanceEmpty(finance);
          const showHabits = view !== 'money' && !habitsEmpty;
          const showMoney = view !== 'habits' && !moneyEmpty;
          if (!showHabits && !showMoney) return <InsightsEmpty view={view} />;

          const pattern = weekdayPattern(occurrences, habits, weekStartsOn);
          const extremes = weekdayExtremes(pattern);
          const money = moneyPeriod(finance, period);
          const tips = [
            ...(showHabits ? suggestions({ current, previous, period, habits, extremes }) : []),
            ...(showMoney
              ? moneySuggestions({
                  data: finance,
                  money,
                  period,
                  today,
                  emergencyFundMonths: settings?.emergencyFundMonths,
                })
              : []),
          ].slice(0, view === 'all' ? 6 : 4);
          return (
            <div className="insights-grid">
              <div className="insights-grid__main">
                {showHabits && (
                  <>
                    <ScoreHero
                      score={momentumScore(current)}
                      previousScore={momentumScore(previous)}
                      current={current}
                      previous={previous}
                      period={period}
                      story={headline(current, previous, period)}
                    />
                    <TrendCard key={weeks.at(-1)?.from} weeks={weeks} />
                  </>
                )}
                {showMoney && <SpendingPatternCard changes={money.changes} period={period} />}
                {showHabits && showMoney && (
                  <HabitsMoneyCard comparison={habitsAndMoney(weeks, finance)} />
                )}
                {showHabits && (
                  <>
                    <ConsistencyCard
                      current={current}
                      previous={previous}
                      summaries={summaries}
                      period={period}
                    />
                    <StreaksCard summaries={summaries} />
                  </>
                )}
              </div>
              <div className="insights-grid__side">
                {showHabits && <KpiGrid current={current} previous={previous} period={period} />}
                {showMoney && <MoneyKpis money={money} period={period} />}
                <SuggestionsCard items={tips} />
                {showHabits && (
                  <>
                    <WeekdayCard pattern={pattern} weeks={RHYTHM_WEEKS} />
                    <TasksCard summary={current} name={period.name} />
                    <AchievementsCard items={achievements(summaries.map((s) => s.stats))} />
                  </>
                )}
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
            <li>
              <Link to="/investments/analysis" className="nav-list__link">
                <span className="nav-list__with-icon">
                  <Wallet size={18} aria-hidden="true" />
                  <span>
                    <span className="nav-list__label">Money analysis</span>
                    <span className="nav-list__meta">
                      Monthly and yearly summaries, by category
                    </span>
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
function InsightsEmpty({ view }: { view: View }) {
  return (
    <section className="insights-empty" aria-labelledby="insights-empty-title">
      <span className="insights-empty__art" aria-hidden="true">
        <Sprout size={30} />
      </span>
      <h2 id="insights-empty-title" className="insights-empty__title">
        Insights grow as you go
      </h2>
      <p className="insights-empty__text">
        {view === 'money'
          ? 'Record income and expenses in Investments. You’ll see spending patterns, savings, and kind suggestions here.'
          : view === 'habits'
            ? 'Check in on a habit or plan a few tasks. After a few days you’ll see your momentum, your best days of the week, streaks, and kind suggestions here.'
            : 'Check in on a habit or record some spending. After a few days you’ll see habits and money side by side, with kind suggestions.'}
      </p>
      <div className="insights-empty__actions">
        {view !== 'money' && (
          <Link to="/habits/new" className="hero-cta insights-empty__cta">
            <Plus size={18} aria-hidden="true" />
            Create a habit
          </Link>
        )}
        {view !== 'habits' && (
          <Link to="/investments" className="button button--secondary insights-empty__cta">
            Open Investments
          </Link>
        )}
      </div>
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
