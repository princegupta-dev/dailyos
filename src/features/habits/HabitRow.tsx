import { Check, Ellipsis, Flame } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CategoryIcon } from '@/components/CategoryIcon';
import { setHabitStatus } from '@/db/repositories/habits';
import {
  describeSchedule,
  describeTarget,
  type Habit,
  type HabitEntry,
  type OccurrenceStatus,
} from '@/domain/habit';
import { useAction } from '@/hooks/useAction';

interface HabitRowProps {
  habit: Habit;
  date: string;
  /**
   * Status of the occurrence covering `date` (weekly habits: the whole week), or null when the
   * habit can't be checked off on `date` (not scheduled, or ended).
   */
  status: OccurrenceStatus | null;
  entry?: HabitEntry | undefined;
  currentStreak: number;
  /** When given, a "more" button opens the log sheet (skip, missed, details). */
  onOpenLog?: (() => void) | undefined;
  /** Optional extra line inside the card, e.g. recent activity on the Habits page. */
  insights?: ReactNode;
}

/**
 * A habit card. Tapping the card opens the habit; the checkbox completes it with one tap, and
 * tapping again undoes an accidental check-off. A completed habit is crossed out.
 */
export function HabitRow({
  habit,
  date,
  status,
  entry,
  currentStreak,
  onOpenLog,
  insights,
}: HabitRowProps) {
  const { run, pending } = useAction();
  const checkable = status !== null;
  const doneToday = entry?.status === 'completed';
  const doneEarlierThisWeek = habit.frequency === 'weekly' && status === 'completed' && !doneToday;
  const done = checkable && (doneToday || doneEarlierThisWeek);

  const meta: string[] = [];
  if (habit.archivedOn) {
    meta.push('Ended');
  } else if (!checkable) {
    meta.push(`Not today · ${describeSchedule(habit)}`);
  } else {
    const target = describeTarget(habit);
    if (entry?.minimum) meta.push('Minimum done');
    else if (target)
      meta.push(entry?.amount !== undefined ? `${entry.amount} / ${target}` : target);
    if (entry?.alternative) meta.push(entry.alternative);
    if (entry?.status === 'skipped') meta.push('Skipped');
    if (entry?.status === 'missed') meta.push('Missed');
    if (doneEarlierThisWeek) meta.push('Done this week');
  }
  const streakUnit = habit.frequency === 'weekly' ? 'weeks' : 'in a row';

  const toggle = () => {
    void run(() =>
      doneToday
        ? setHabitStatus(habit.id, date, null)
        : setHabitStatus(habit.id, date, 'completed'),
    );
  };

  const state = !checkable ? 'off' : done ? 'done' : (entry?.status ?? 'pending');
  return (
    <li className={`habit-row habit-row--${state}`}>
      <CategoryIcon category={habit.category} icon={habit.icon} tone={habit.tone} />
      <Link to={`/habits/${habit.id}`} className="habit-row__body">
        <span className="habit-row__name">{habit.name}</span>
        {meta.length > 0 && <span className="habit-row__meta">{meta.join(' · ')}</span>}
        {insights}
      </Link>
      {currentStreak > 1 && (
        <span className="streak-badge habit-row__streak" title={`${currentStreak} ${streakUnit}`}>
          <Flame size={13} aria-hidden="true" />
          {currentStreak}
          <span className="visually-hidden"> {streakUnit}</span>
        </span>
      )}
      {onOpenLog && checkable && (
        <button
          type="button"
          className="icon-button icon-button--plain habit-row__more"
          aria-label={`More options for ${habit.name}`}
          onClick={onOpenLog}
        >
          <Ellipsis size={18} aria-hidden="true" />
        </button>
      )}
      {checkable && (
        <label className="habit-check">
          <input
            type="checkbox"
            className="habit-check__input"
            aria-label={`Mark ${habit.name} done`}
            checked={done}
            disabled={pending || doneEarlierThisWeek}
            onChange={toggle}
          />
          <span className="habit-check__box" aria-hidden="true">
            <Check size={18} strokeWidth={3} />
          </span>
        </label>
      )}
    </li>
  );
}
