import { ArrowLeft, Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/Dialog';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { endHabit, getHabitDetail, updateHabit, type HabitDetail } from '@/db/repositories/habits';
import {
  currentStreak,
  describeSchedule,
  habitOccurrences,
  isScheduledOn,
  occurrencesToDate,
  summarizeOccurrences,
  type OccurrenceStatus,
} from '@/domain/habit';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { addDays, eachDay } from '@/lib/dates';
import { relativeDayLabel } from '@/lib/format';
import { HabitForm } from './HabitForm';
import { HabitStatusButtons } from './HabitStatusButtons';

const STATUS_TEXT: Record<OccurrenceStatus, string> = {
  completed: 'Done',
  skipped: 'Skipped',
  missed: 'Missed',
  pending: 'Not yet',
};

const RECENT_DAYS = 14;

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
            <Link to="/settings">Back to settings</Link>
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
  const [editing, setEditing] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const ended = habit.archivedOn !== undefined;

  const all = occurrencesToDate(
    habit,
    entries,
    ended && habit.archivedOn ? addDays(habit.archivedOn, -1) : today,
    weekStartsOn,
  );
  const last30 = summarizeOccurrences(
    habitOccurrences(habit, entries, addDays(today, -29), today, today, weekStartsOn),
  );
  const streak = currentStreak(all);
  const entryByDate = new Map(entries.map((e) => [e.date, e]));

  const recentDays = eachDay(addDays(today, -(RECENT_DAYS - 1)), today)
    .reverse()
    .filter((d) => isScheduledOn(habit, d));
  const recentWeeks = all.slice(-6).reverse();

  return (
    <>
      <PageHeader
        eyebrow={
          ended
            ? `Ended ${relativeDayLabel(habit.archivedOn ?? today, today)}`
            : describeSchedule(habit)
        }
        title={habit.name}
        description={habit.description}
        actions={
          <Link to="/settings" className="icon-button" aria-label="Back to settings">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
      />

      <dl className="stat-row">
        <div className="stat">
          <dt>Current streak</dt>
          <dd>
            {streak} {habit.frequency === 'weekly' ? 'wk' : 'days'}
          </dd>
        </div>
        <div className="stat">
          <dt>Last 30 days</dt>
          <dd>{last30.rate === null ? '—' : `${Math.round(last30.rate * 100)}%`}</dd>
        </div>
        <div className="stat">
          <dt>Skipped</dt>
          <dd>{last30.skipped}</dd>
        </div>
      </dl>
      <p className="muted small stat-note">
        Skipped occurrences don’t count against your rate or break streaks.
      </p>

      {editing ? (
        <Section title="Edit habit">
          <HabitForm
            initial={habit}
            submitLabel="Save changes"
            onCancel={() => {
              setEditing(false);
            }}
            onSubmit={async (draft) => {
              await updateHabit(habit.id, draft);
              notify({ kind: 'success', message: 'Habit saved' });
              setEditing(false);
            }}
          />
        </Section>
      ) : (
        <Section
          title={habit.frequency === 'weekly' ? 'Recent weeks' : 'Recent days'}
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
          {habit.frequency === 'weekly' ? (
            <ul className="picker-list">
              {recentWeeks.map((o) => (
                <li key={o.start} className="picker-list__item">
                  <span>Week of {relativeDayLabel(o.start, today)}</span>
                  <span className={`status-text status-text--${o.status}`}>
                    {STATUS_TEXT[o.status]}
                  </span>
                </li>
              ))}
              {!ended && isScheduledOn(habit, today) && (
                <li className="picker-list__item">
                  <span>Log for today</span>
                  <HabitStatusButtons
                    habitId={habit.id}
                    habitName={habit.name}
                    date={today}
                    current={entryByDate.get(today)?.status}
                  />
                </li>
              )}
            </ul>
          ) : recentDays.length === 0 ? (
            <p className="muted">No scheduled days yet.</p>
          ) : (
            <ul className="picker-list">
              {recentDays.map((day) => (
                <li key={day} className="picker-list__item">
                  <span>{relativeDayLabel(day, today)}</span>
                  {ended ? (
                    <span>{entryByDate.get(day)?.status ?? '—'}</span>
                  ) : (
                    <HabitStatusButtons
                      habitId={habit.id}
                      habitName={`${habit.name} on ${relativeDayLabel(day, today)}`}
                      date={day}
                      current={entryByDate.get(day)?.status}
                      showMissed={day < today}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          {habit.frequency !== 'weekly' && (
            <p className="muted small section__action">
              Days without a check-in count as missed once they’re over.
            </p>
          )}
        </Section>
      )}

      {!ended && (
        <Section title="End habit">
          <p className="muted small">
            Ending stops the habit from today. Its history stays in your reviews. To try again
            later, create a new habit.
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
