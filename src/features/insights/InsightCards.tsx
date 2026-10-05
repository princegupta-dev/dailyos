import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  CircleCheckBig,
  Flame,
  HeartHandshake,
  Lightbulb,
  ListChecks,
  Lock,
  Minus,
  NotebookPen,
  Repeat,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ProgressRing } from '@/components/ProgressRing';
import { Section } from '@/components/Section';
import type { HabitSummary } from '@/db/repositories/habits';
import { useCountUp } from '@/hooks/useCountUp';
import type { RangeSummary } from '@/services/analytics.service';
import { nextMilestone } from '../habits/habitHistory';
import { percent } from '../reviews/format';
import {
  planRate,
  pointsChange,
  trendOf,
  type Achievement,
  type InsightPeriod,
  type Suggestion,
  type SuggestionTone,
} from './insightsModel';

/* ---------- Trend chip ---------- */

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

/** A small arrow and the change against the previous period. `unit` is "pts" for rates. */
export function TrendChip({
  change,
  unit,
  compareTo,
  tone = 'default',
}: {
  change: number | null;
  unit: string;
  compareTo: string;
  tone?: 'default' | 'on-dark';
}) {
  const trend = trendOf(change, unit === 'pts' ? 3 : 1);
  if (trend === null || change === null) return null;
  const Icon = TREND_ICON[trend];
  const text =
    trend === 'flat'
      ? 'Steady'
      : `${change > 0 ? '+' : '−'}${Math.abs(change)}${unit ? ` ${unit}` : ''}`;
  return (
    <span
      className={`trend-chip trend-chip--${trend}${tone === 'on-dark' ? ' trend-chip--on-dark' : ''}`}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {text}
      <span className="visually-hidden"> compared with {compareTo}</span>
    </span>
  );
}

/* ---------- Score ---------- */

/** The period at a glance: one score, the sentence that explains it, and its two parts. */
export function ScoreHero({
  score,
  previousScore,
  current,
  previous,
  period,
  story,
}: {
  score: number | null;
  previousScore: number | null;
  current: RangeSummary;
  previous: RangeSummary;
  period: InsightPeriod;
  story: string;
}) {
  const shown = useCountUp(score ?? 0);
  const change = score === null || previousScore === null ? null : score - previousScore;
  return (
    <section className="insights-score" aria-labelledby="insights-score-title">
      <div className="insights-score__ring">
        <ProgressRing
          value={score ?? 0}
          max={100}
          size={136}
          stroke={11}
          label={score === null ? 'No score yet' : `Momentum score ${score} of 100`}
        >
          <span className="insights-score__number">
            {score === null ? '—' : shown}
            <span className="insights-score__of">momentum</span>
          </span>
        </ProgressRing>
      </div>
      <div className="insights-score__text">
        <h2 id="insights-score-title" className="insights-score__eyebrow">
          <Sparkles size={14} aria-hidden="true" /> Momentum, {period.name}
        </h2>
        <p className="insights-score__story">{story}</p>
        <ul className="insights-score__parts">
          <li>
            <span className="insights-score__part-label">Habits</span>
            <strong>{percent(current.habits.overall.rate)}</strong>
            <TrendChip
              change={pointsChange(current.habits.overall.rate, previous.habits.overall.rate)}
              unit="pts"
              compareTo={period.prevName}
              tone="on-dark"
            />
          </li>
          <li>
            <span className="insights-score__part-label">Plan kept</span>
            <strong>{percent(planRate(current))}</strong>
            <TrendChip
              change={pointsChange(planRate(current), planRate(previous))}
              unit="pts"
              compareTo={period.prevName}
              tone="on-dark"
            />
          </li>
          {change !== null && (
            <li>
              <span className="insights-score__part-label">Score</span>
              <TrendChip change={change} unit="pts" compareTo={period.prevName} tone="on-dark" />
            </li>
          )}
        </ul>
        <p className="insights-score__note">
          The average of habits done and plan kept. Skipped days never count against you.
        </p>
      </div>
    </section>
  );
}

/* ---------- Key numbers ---------- */

interface Kpi {
  icon: LucideIcon;
  label: string;
  value: string;
  change: number | null;
  unit: string;
  /** 0–1 for a slim bar under the value. */
  rate?: number | null | undefined;
}

export function KpiGrid({
  current,
  previous,
  period,
}: {
  current: RangeSummary;
  previous: RangeSummary;
  period: InsightPeriod;
}) {
  const kpis: Kpi[] = [
    {
      icon: Repeat,
      label: 'Habits done',
      value: percent(current.habits.overall.rate),
      change: pointsChange(current.habits.overall.rate, previous.habits.overall.rate),
      unit: 'pts',
      rate: current.habits.overall.rate,
    },
    {
      icon: ListChecks,
      label: 'Plan kept',
      value: percent(planRate(current)),
      change: pointsChange(planRate(current), planRate(previous)),
      unit: 'pts',
      rate: planRate(current),
    },
    {
      icon: CircleCheckBig,
      label: 'Tasks finished',
      value: String(current.tasksCompleted),
      change: current.tasksCompleted - previous.tasksCompleted,
      unit: '',
    },
    {
      icon: NotebookPen,
      label: 'Notes captured',
      value: String(current.learning.count),
      change: current.learning.count - previous.learning.count,
      unit: '',
    },
  ];
  return (
    <dl className="kpis" aria-label={`Key numbers, ${period.name}`}>
      {kpis.map(({ icon: Icon, label, value, change, unit, rate }) => (
        <div key={label} className="kpi">
          <dt className="kpi__label">
            <span className="kpi__icon" aria-hidden="true">
              <Icon size={14} />
            </span>
            {label}
          </dt>
          <dd className="kpi__value">{value}</dd>
          <dd className="kpi__foot">
            {rate !== undefined && (
              <span className="kpi__bar" aria-hidden="true">
                <span style={{ inlineSize: `${Math.round((rate ?? 0) * 100)}%` }} />
              </span>
            )}
            <TrendChip change={change} unit={unit} compareTo={period.prevName} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Habit consistency ---------- */

export function ConsistencyCard({
  current,
  previous,
  summaries,
  period,
}: {
  current: RangeSummary;
  previous: RangeSummary;
  summaries: readonly HabitSummary[];
  period: InsightPeriod;
}) {
  const rows = [...current.habits.perHabit]
    .filter((h) => h.summary.completed + h.summary.missed + h.summary.pending > 0)
    .sort((a, b) => (b.summary.rate ?? -1) - (a.summary.rate ?? -1));
  return (
    <Section
      title="Habit consistency"
      icon={Repeat}
      description={`Each habit, ${period.name}.`}
      meta={percent(current.habits.overall.rate)}
      className="insights-card insights-consistency"
    >
      {rows.length === 0 ? (
        <p className="quiet-note">No habit check-ins {period.name} yet.</p>
      ) : (
        <ul className="habit-bars">
          {rows.map(({ habitId, name, summary: s }, index) => {
            const habit = summaries.find((x) => x.habit.id === habitId)?.habit;
            const before = previous.habits.perHabit.find((p) => p.habitId === habitId);
            const strong = s.rate !== null && s.rate >= 0.8;
            const care = s.rate !== null && s.rate < 0.5 && s.completed + s.missed >= 3;
            return (
              <li
                key={habitId}
                className="habit-bars__item"
                style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              >
                {habit ? (
                  <CategoryIcon
                    category={habit.category}
                    icon={habit.icon}
                    tone={habit.tone}
                    size="sm"
                  />
                ) : (
                  <span
                    className="category-icon category-icon--sm tone--slate"
                    aria-hidden="true"
                  />
                )}
                <div className="habit-bars__body">
                  <div className="habit-bars__head">
                    <Link to={`/habits/${habitId}`} className="habit-bars__name">
                      {name}
                    </Link>
                    {strong && (
                      <span className="habit-bars__badge habit-bars__badge--strong">Strong</span>
                    )}
                    {care && (
                      <span className="habit-bars__badge habit-bars__badge--care">Needs care</span>
                    )}
                    <span className="habit-bars__value">
                      {percent(s.rate)}
                      <TrendChip
                        change={pointsChange(s.rate, before?.summary.rate ?? null)}
                        unit="pts"
                        compareTo={period.prevName}
                      />
                    </span>
                  </div>
                  <span className="habit-bars__track" aria-hidden="true">
                    <span
                      className={
                        strong
                          ? 'habit-bars__fill--strong'
                          : care
                            ? 'habit-bars__fill--care'
                            : undefined
                      }
                      style={{ inlineSize: `${Math.round((s.rate ?? 0) * 100)}%` }}
                    />
                  </span>
                  <span className="habit-bars__meta">
                    {s.completed + s.missed === 0
                      ? 'Nothing counted yet'
                      : `${s.completed} of ${s.completed + s.missed} done`}
                    {s.skipped > 0 ? ` · ${s.skipped} skipped` : ''}
                    {s.pending > 0 ? ` · ${s.pending} to go` : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ---------- Streaks ---------- */

const STREAKS_SHOWN = 5;

export function StreaksCard({ summaries }: { summaries: readonly HabitSummary[] }) {
  const ranked = summaries
    .filter((s) => s.stats.totalCompletions > 0)
    .sort(
      (a, b) =>
        b.stats.currentStreak - a.stats.currentStreak ||
        b.stats.longestStreak - a.stats.longestStreak,
    )
    .slice(0, STREAKS_SHOWN);
  return (
    <Section title="Streaks" icon={Flame} className="insights-card insights-streaks">
      {ranked.length === 0 ? (
        <p className="quiet-note">Streaks appear once you complete a habit.</p>
      ) : (
        <ol className="streak-board">
          {ranked.map(({ habit, stats }, i) => {
            const unit = habit.frequency === 'weekly' ? 'week' : 'day';
            const next = nextMilestone(stats.currentStreak);
            const toNext = next === undefined ? 1 : stats.currentStreak / next;
            return (
              <li
                key={habit.id}
                className={`streak-board__item${i === 0 ? ' streak-board__item--lead' : ''}`}
              >
                <CategoryIcon
                  category={habit.category}
                  icon={habit.icon}
                  tone={habit.tone}
                  size="sm"
                />
                <div className="streak-board__body">
                  <Link to={`/habits/${habit.id}`} className="streak-board__name">
                    {habit.name}
                  </Link>
                  <span className="streak-board__track" aria-hidden="true">
                    <span style={{ inlineSize: `${Math.round(toNext * 100)}%` }} />
                  </span>
                  <span className="streak-board__meta">
                    {next === undefined
                      ? 'Past every milestone'
                      : stats.currentStreak === 0
                        ? `Best ${stats.longestStreak} · start again today`
                        : `${next - stats.currentStreak} to ${next} · best ${stats.longestStreak}`}
                  </span>
                </div>
                <span
                  className={`streak-board__count${stats.currentStreak === 0 ? ' streak-board__count--cold' : ''}`}
                >
                  <Flame size={16} aria-hidden="true" />
                  {stats.currentStreak}
                  <span className="visually-hidden">
                    {' '}
                    {unit}
                    {stats.currentStreak === 1 ? '' : 's'} current streak
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

/* ---------- Milestones ---------- */

export function AchievementsCard({ items }: { items: readonly Achievement[] }) {
  if (items.length === 0) return null;
  const earned = items.filter((a) => a.earned).length;
  return (
    <Section
      title="Milestones"
      icon={Trophy}
      meta={`${earned} earned`}
      className="insights-card insights-achievements"
    >
      <ul className="badges">
        {items.map((a) => (
          <li key={a.id} className={`badge${a.earned ? ' badge--earned' : ''}`}>
            <span className="badge__medal" aria-hidden="true">
              {a.earned ? <Award size={20} /> : <Lock size={16} />}
            </span>
            <span className="badge__title">{a.title}</span>
            <span className="badge__desc">
              {a.earned ? a.description : `${a.value} of ${a.goal}`}
            </span>
            {!a.earned && (
              <span
                className="badge__track"
                role="img"
                aria-label={`${Math.round((a.value / a.goal) * 100)}% of the way`}
              >
                <span style={{ inlineSize: `${Math.min((a.value / a.goal) * 100, 100)}%` }} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------- Suggestions ---------- */

const SUGGESTION_ICON: Record<SuggestionTone, LucideIcon> = {
  celebrate: Sparkles,
  care: HeartHandshake,
  idea: Lightbulb,
};

const SUGGESTION_LABEL: Record<SuggestionTone, string> = {
  celebrate: 'Going well',
  care: 'Needs care',
  idea: 'Try this',
};

export function SuggestionsCard({ items }: { items: readonly Suggestion[] }) {
  return (
    <Section
      title="What the numbers say"
      icon={Lightbulb}
      description="A few kind, specific next steps."
      className="insights-card insights-suggestions"
    >
      {items.length === 0 ? (
        <p className="quiet-note">
          Suggestions appear once there’s a little more history. Keep checking in.
        </p>
      ) : (
        <ul className="suggestions">
          {items.map((s, i) => {
            const Icon = SUGGESTION_ICON[s.tone];
            return (
              <li
                key={s.id}
                className={`suggestion suggestion--${s.tone}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="suggestion__icon" aria-hidden="true">
                  <Icon size={17} />
                </span>
                <div className="suggestion__body">
                  <p className="suggestion__label">{SUGGESTION_LABEL[s.tone]}</p>
                  <p className="suggestion__title">{s.title}</p>
                  <p className="suggestion__text">{s.body}</p>
                  {s.action && (
                    <Link to={s.action.to} className="suggestion__action">
                      {s.action.label} <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
