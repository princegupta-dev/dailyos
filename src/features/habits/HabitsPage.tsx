import { Archive, CircleCheckBig, Plus, Repeat, Sparkles } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LiveView, SkeletonCards } from '@/components/LiveView';
import { PageHero } from '@/components/PageHero';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  getRecentOccurrences,
  listHabitSummaries,
  type HabitSummary,
} from '@/db/repositories/habits';
import type { Occurrence } from '@/domain/habit';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { HabitCraft } from './HabitCraft';
import { HabitInsights } from './HabitInsights';
import { HabitRow } from './HabitRow';
import { HabitsOverview } from './HabitsOverview';

/** Days of history behind each card's dots and rate, and the overview's check-ins. */
const WINDOW_DAYS = 30;
const NO_HISTORY: ReadonlyMap<string, readonly Occurrence[]> = new Map();

type Filter = 'all' | 'due' | 'done';

/** Every habit in one list: check off today's from here, tap a card for its details. */
export function HabitsPage() {
  const today = useToday();
  const weekStartsOn = useWeekStartsOn();
  const [showEnded, setShowEnded] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const summaries = useLiveData(
    useCallback(() => listHabitSummaries(today, weekStartsOn, true), [today, weekStartsOn]),
  );
  const history = useLiveData(
    useCallback(
      () => getRecentOccurrences(today, weekStartsOn, WINDOW_DAYS),
      [today, weekStartsOn],
    ),
  );
  const recent = history.status === 'ready' ? history.data : NO_HISTORY;

  return (
    <div className="habits-page">
      <PageHero
        eyebrow={formatDateKey(today, undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        title="Habits"
        subtitle={
          <>
            Small actions, <em>repeated</em>.
          </>
        }
        actions={
          <Link to="/habits/new" className="hero-cta" aria-label="New habit">
            <Plus size={18} aria-hidden="true" />
            <span className="hero-cta__label" aria-hidden="true">
              New habit
            </span>
          </Link>
        }
      />
      <LiveView
        state={summaries}
        loadingLabel="Loading habits…"
        skeleton={<SkeletonCards count={4} height={84} />}
      >
        {(all) => {
          if (all.length === 0) return <NoHabits />;
          const active = all.filter((s) => s.habit.archivedOn === undefined);
          const ended = all.filter((s) => s.habit.archivedOn !== undefined);
          const due = active.filter((s) => s.todayStatus === 'pending');
          const done = active.filter((s) => s.todayStatus === 'completed');
          const visible =
            filter === 'due'
              ? due
              : filter === 'done'
                ? done
                : showEnded
                  ? [...active, ...ended]
                  : active;

          return (
            <div className="habits-page__grid">
              <div className="habits-page__side">
                <div className="habits-page__block habits-page__block--overview">
                  <HabitsOverview
                    active={active}
                    recent={recent}
                    windowDays={WINDOW_DAYS}
                    today={today}
                    weekStartsOn={weekStartsOn}
                  />
                </div>
                <div className="habits-page__block habits-page__block--craft">
                  <HabitCraft />
                </div>
              </div>

              <div className="habits-page__main">
                <div className="habits-page__block habits-page__block--list">
                  <Section
                    title="Your habits"
                    icon={Repeat}
                    description="Tick today’s off here, or open one for its story"
                    meta={`${active.length} active`}
                  >
                    <SegmentedControl
                      label="Show habits"
                      value={filter}
                      options={[
                        { value: 'all', label: 'All' },
                        { value: 'due', label: `Due today · ${due.length}` },
                        { value: 'done', label: `Done · ${done.length}` },
                      ]}
                      onChange={setFilter}
                    />
                    {visible.length > 0 ? (
                      <ul className="habit-list habit-list--rich" aria-label="All habits">
                        {visible.map((summary) => (
                          <RichHabitRow
                            key={summary.habit.id}
                            summary={summary}
                            today={today}
                            recent={recent.get(summary.habit.id) ?? []}
                          />
                        ))}
                      </ul>
                    ) : (
                      <FilterEmpty filter={filter} />
                    )}
                    <div className="habits-page__footer">
                      <Link to="/habits/new" className="habit-add">
                        <span className="habit-add__icon" aria-hidden="true">
                          <Plus size={18} />
                        </span>
                        <span>
                          <span className="habit-add__title">Add a habit</span>
                          <span className="habit-add__hint">
                            Two minutes to set up. Start small.
                          </span>
                        </span>
                      </Link>
                      {ended.length > 0 && filter === 'all' && (
                        <button
                          type="button"
                          className="ended-toggle"
                          aria-pressed={showEnded}
                          onClick={() => {
                            setShowEnded((v) => !v);
                          }}
                        >
                          <Archive size={15} aria-hidden="true" />
                          {showEnded ? 'Hide ended habits' : `Show ended habits (${ended.length})`}
                        </button>
                      )}
                    </div>
                  </Section>
                </div>
              </div>
            </div>
          );
        }}
      </LiveView>
    </div>
  );
}

function RichHabitRow({
  summary,
  today,
  recent,
}: {
  summary: HabitSummary;
  today: string;
  recent: readonly Occurrence[];
}) {
  const { habit, stats, todayEntry, todayStatus } = summary;
  return (
    <HabitRow
      habit={habit}
      date={today}
      status={todayStatus}
      entry={todayEntry}
      currentStreak={stats.currentStreak}
      insights={
        habit.archivedOn === undefined ? (
          <HabitInsights
            recent={recent}
            weekly={habit.frequency === 'weekly'}
            longestStreak={stats.longestStreak}
            windowDays={WINDOW_DAYS}
          />
        ) : undefined
      }
    />
  );
}

function FilterEmpty({ filter }: { filter: Filter }) {
  return filter === 'due' ? (
    <EmptyState
      icon={CircleCheckBig}
      title="Nothing left for today"
      description="Every habit due today is done or skipped. Enjoy the space."
    />
  ) : (
    <EmptyState
      icon={Sparkles}
      title="Nothing checked off yet"
      description="Tick a habit and it will show up here."
    />
  );
}

/** First visit: a warm invitation, the main call to action, and a few principles. */
function NoHabits() {
  return (
    <div className="habits-empty">
      <div className="habits-empty__hero">
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          description="Start with one or two small habits. You can add details and alternatives later."
        />
        <Link to="/habits/new" className="button button--primary button--block">
          <Plus size={18} aria-hidden="true" />
          Create your first habit
        </Link>
      </div>
      <HabitCraft />
    </div>
  );
}
