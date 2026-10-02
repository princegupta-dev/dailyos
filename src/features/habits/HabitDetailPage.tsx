import { ArrowLeft, Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfirmDialog } from '@/components/Dialog';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { endHabit, getHabitDetail, updateHabit, type HabitDetail } from '@/db/repositories/habits';
import { CATEGORY_LABELS } from '@/domain/categories';
import {
  describeSchedule,
  describeTarget,
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
import { relativeDayLabel } from '@/lib/format';
import { HabitCalendar } from './HabitCalendar';
import { HabitEditForm } from './HabitForm';
import { HabitLogSheet } from './HabitLogSheet';
import { HabitNotes } from './HabitNotes';

type Tab = 'overview' | 'calendar' | 'notes';
const TABS: readonly { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'notes', label: 'Notes' },
];

type Range = 'week' | 'month' | '30' | 'all';
const RANGES: readonly { value: Range; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: '30', label: '30 days' },
  { value: 'all', label: 'All' },
];

export function HabitDetailPage() {
  const { habitId = '' } = useParams();
  const detail = useLiveData(useCallback(() => getHabitDetail(habitId), [habitId]));
  return (
    <LiveView state={detail}>
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

  const lastDay = ended && habit.archivedOn ? addDays(habit.archivedOn, -1) : today;
  const stats = habitStats(occurrencesToDate(habit, entries, lastDay, weekStartsOn));
  const rangeStart: Record<Range, string> = {
    week: startOfWeek(today, weekStartsOn),
    month: startOfMonth(today),
    '30': addDays(today, -29),
    all:
      habit.frequency === 'weekly' ? startOfWeek(habit.startDate, weekStartsOn) : habit.startDate,
  };
  const period = summarizeOccurrences(
    habitOccurrences(habit, entries, rangeStart[range], lastDay, today, weekStartsOn),
  );
  const target = describeTarget(habit);
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
    <>
      <PageHeader
        eyebrow={
          ended
            ? `Ended ${relativeDayLabel(habit.archivedOn ?? today, today)}`
            : `${CATEGORY_LABELS[habit.category]} · ${describeSchedule(habit)}`
        }
        title={habit.name}
        leading={
          <Link to="/habits" className="icon-button" aria-label="Back to habits">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
      />
      <SegmentedControl label="Habit view" value={tab} options={TABS} onChange={setTab} />

      {tab === 'overview' && (
        <>
          <div className="habit-hero">
            <CategoryIcon category={habit.category} />
            <dl className="stat-row stat-row--compact">
              <div className="stat">
                <dt>Streak</dt>
                <dd>{stats.currentStreak}</dd>
              </div>
              <div className="stat">
                <dt>Best</dt>
                <dd>{stats.longestStreak}</dd>
              </div>
              <div className="stat">
                <dt>Total</dt>
                <dd>{stats.totalCompletions}</dd>
              </div>
            </dl>
          </div>

          {!ended && isScheduledOn(habit, today) && (
            <button
              type="button"
              className="button button--primary button--block section__action log-today"
              onClick={() => {
                setLogDate(today);
              }}
            >
              {entryOn(today) ? 'Edit today’s entry' : 'Log today'}
            </button>
          )}

          <Section title="Completion rate">
            <SegmentedControl label="Period" value={range} options={RANGES} onChange={setRange} />
            <dl className="stat-row">
              <div className="stat">
                <dt>Rate</dt>
                {period.rate === null ? (
                  <dd className="stat__empty">Not enough data</dd>
                ) : (
                  <dd>{Math.round(period.rate * 100)}%</dd>
                )}
              </div>
              <div className="stat">
                <dt>Done</dt>
                <dd>{period.completed}</dd>
              </div>
              <div className="stat">
                <dt>Missed</dt>
                <dd>{period.missed}</dd>
              </div>
            </dl>
            <p className="muted small">
              {period.skipped > 0 ? `${period.skipped} skipped. ` : ''}Skipped and unscheduled days
              don’t count against you.
            </p>
          </Section>

          <Section
            title="Setup"
            meta={
              !ended ? (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setEditing(true);
                  }}
                >
                  <Pencil size={16} aria-hidden="true" /> Edit
                </button>
              ) : undefined
            }
          >
            <dl className="detail-list">
              <div className="detail-list__row">
                <dt>Schedule</dt>
                <dd>{describeSchedule(habit)}</dd>
              </div>
              <div className="detail-list__row">
                <dt>Target</dt>
                <dd>{target ?? 'None'}</dd>
              </div>
              {habit.minimumTarget && (
                <div className="detail-list__row detail-list__row--wide">
                  <dt>Minimum version</dt>
                  <dd>{habit.minimumTarget}</dd>
                </div>
              )}
              {habit.alternatives && (
                <div className="detail-list__row detail-list__row--wide">
                  <dt>Alternatives</dt>
                  <dd>{habit.alternatives.join(', ')}</dd>
                </div>
              )}
              {habit.description && (
                <div className="detail-list__row detail-list__row--wide">
                  <dt>Why it matters</dt>
                  <dd>{habit.description}</dd>
                </div>
              )}
            </dl>
          </Section>

          {!ended && (
            <Section title="End habit">
              <p className="muted small">
                Ending stops it from today. Its history stays in your insights and reviews.
              </p>
              <button
                type="button"
                className="button button--secondary button--compact section__action"
                onClick={() => {
                  setConfirmEnd(true);
                }}
              >
                End habit
              </button>
            </Section>
          )}
        </>
      )}

      {tab === 'calendar' && (
        <HabitCalendar
          habit={habit}
          entries={entries}
          today={today}
          weekStartsOn={weekStartsOn}
          onSelectDay={ended ? undefined : setLogDate}
        />
      )}

      {tab === 'notes' && (
        <HabitNotes entries={entries} today={today} onOpen={ended ? undefined : setLogDate} />
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
    </>
  );
}
