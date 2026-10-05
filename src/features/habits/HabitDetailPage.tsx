import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/Dialog';
import { LiveView, SkeletonCards } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { endHabit, getHabitDetail, updateHabit, type HabitDetail } from '@/db/repositories/habits';
import {
  habitOccurrences,
  habitStats,
  isScheduledOn,
  occurrencesToDate,
  summarizeOccurrences,
} from '@/domain/habit';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { addDays, startOfMonth, startOfWeek } from '@/lib/dates';
import { HabitCalendar } from './HabitCalendar';
import { HabitDetailHero } from './HabitDetailHero';
import { HabitEditForm } from './HabitForm';
import { heatmapDays, weeklyTrend } from './habitHistory';
import { HabitLogSheet } from './HabitLogSheet';
import { HabitNotes } from './HabitNotes';
import { EndHabitCard, HabitReflectionsCard, HabitSetupCard } from './HabitSetup';
import {
  ConsistencyCard,
  HabitHeatmap,
  HabitInsightList,
  StreakPanel,
  type Range,
} from './HabitStats';

type Tab = 'overview' | 'calendar' | 'notes';
const TABS: readonly { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'notes', label: 'Notes' },
];

export function HabitDetailPage() {
  const { habitId = '' } = useParams();
  const detail = useLiveData(useCallback(() => getHabitDetail(habitId), [habitId]));
  return (
    <LiveView
      state={detail}
      loadingLabel="Loading habit…"
      skeleton={<SkeletonCards count={3} height={140} />}
    >
      {(data) =>
        data ? (
          <HabitDetailView detail={data} />
        ) : (
          <>
            <PageHeader title="Habit not found" />
            <Link to="/habits">Back to habits</Link>
          </>
        )
      }
    </LiveView>
  );
}

function HabitDetailView({ detail }: { detail: HabitDetail }) {
  const { habit, entries } = detail;
  const today = useToday();
  const weekStartsOn = useWeekStartsOn();
  const { run, pending, notify } = useAction();
  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState<Range>('month');
  const [editing, setEditing] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [logDate, setLogDate] = useState<string | null>(null);
  const ended = habit.archivedOn !== undefined;
  const weekly = habit.frequency === 'weekly';

  const lastDay = ended && habit.archivedOn ? addDays(habit.archivedOn, -1) : today;
  const allOccurrences = occurrencesToDate(habit, entries, lastDay, weekStartsOn);
  const stats = habitStats(allOccurrences);
  const rangeStart: Record<Range, string> = {
    week: startOfWeek(today, weekStartsOn),
    month: startOfMonth(today),
    '30': addDays(today, -29),
    all: weekly ? startOfWeek(habit.startDate, weekStartsOn) : habit.startDate,
  };
  const period = summarizeOccurrences(
    habitOccurrences(habit, entries, rangeStart[range], lastDay, today, weekStartsOn),
  );
  const entryOn = (date: string) => entries.find((e) => e.date === date);

  if (editing) {
    return (
      <>
        <PageHeader title="Edit habit" />
        <HabitEditForm
          habit={habit}
          onCancel={() => {
            setEditing(false);
          }}
          onSubmit={async (draft) => {
            await updateHabit(habit.id, draft);
            notify({ kind: 'success', message: 'Habit saved' });
            setEditing(false);
          }}
        />
      </>
    );
  }

  return (
    <div className="habit-detail">
      <HabitDetailHero
        habit={habit}
        today={today}
        todayEntry={entryOn(today)}
        canLogToday={!ended && isScheduledOn(habit, today)}
        onLogToday={() => {
          setLogDate(today);
        }}
        onEdit={
          ended
            ? undefined
            : () => {
                setEditing(true);
              }
        }
      />

      <SegmentedControl label="Habit view" value={tab} options={TABS} onChange={setTab} />

      {tab === 'overview' && (
        <div className="habit-detail__grid">
          <div className="habit-detail__main">
            <StreakPanel
              currentStreak={stats.currentStreak}
              longestStreak={stats.longestStreak}
              totalCompletions={stats.totalCompletions}
              weekly={weekly}
            />
            <ConsistencyCard
              range={range}
              onRangeChange={setRange}
              period={period}
              trend={weeklyTrend(habit, entries, today, lastDay, weekStartsOn)}
            />
            <HabitHeatmap days={heatmapDays(habit, entries, today, weekStartsOn)} />
          </div>
          <div className="habit-detail__side">
            <HabitInsightList
              occurrences={allOccurrences}
              entries={entries}
              weekly={weekly}
              today={today}
            />
            <HabitSetupCard habit={habit} today={today} />
            <HabitReflectionsCard habit={habit} today={today} />
            {!ended && (
              <EndHabitCard
                onEnd={() => {
                  setConfirmEnd(true);
                }}
              />
            )}
          </div>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="habit-detail__panel">
          <HabitCalendar
            habit={habit}
            entries={entries}
            today={today}
            weekStartsOn={weekStartsOn}
            onSelectDay={ended ? undefined : setLogDate}
          />
        </div>
      )}

      {tab === 'notes' && (
        <div className="habit-detail__panel">
          <HabitNotes entries={entries} today={today} onOpen={ended ? undefined : setLogDate} />
        </div>
      )}

      {logDate && (
        <HabitLogSheet
          key={logDate}
          habit={habit}
          date={logDate}
          today={today}
          entry={entryOn(logDate)}
          onClose={() => {
            setLogDate(null);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmEnd}
        title={`End “${habit.name}”?`}
        message="It will no longer appear on Today. Past check-ins are kept. This can’t be undone."
        confirmLabel="End habit"
        destructive
        pending={pending}
        onCancel={() => {
          setConfirmEnd(false);
        }}
        onConfirm={() => {
          void run(() => endHabit(habit.id), 'Habit ended').then(() => {
            setConfirmEnd(false);
          });
        }}
      />
    </div>
  );
}
