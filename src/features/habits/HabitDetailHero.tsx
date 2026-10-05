import { ArrowLeft, CalendarDays, Clock, PenLine, Pencil, Target } from 'lucide-react';
import { Link } from 'react-router';
import { CategoryIcon } from '@/components/CategoryIcon';
import { describeWhen } from '@/domain/appearance';
import { CATEGORY_APPEARANCE, CATEGORY_LABELS } from '@/domain/categories';
import { describeSchedule, describeTarget, type Habit, type HabitEntry } from '@/domain/habit';
import { inlineDayLabel, relativeDayLabel } from '@/lib/format';

interface HabitDetailHeroProps {
  habit: Habit;
  today: string;
  /** Entry for today, when the habit can be logged today. */
  todayEntry: HabitEntry | undefined;
  /** Whether today can be logged (scheduled and not ended). */
  canLogToday: boolean;
  onLogToday: () => void;
  onEdit?: (() => void) | undefined;
}

const TODAY_STATUS = { completed: 'Done today', skipped: 'Skipped today', missed: 'Missed today' };

/**
 * The habit's identity: its tile, name, area and schedule, why it matters, and the two
 * things you most often do here — log today and edit.
 */
export function HabitDetailHero({
  habit,
  today,
  todayEntry,
  canLogToday,
  onLogToday,
  onEdit,
}: HabitDetailHeroProps) {
  const ended = habit.archivedOn !== undefined;
  const target = describeTarget(habit);
  const when = describeWhen(habit);
  const upcoming = habit.startDate > today;
  const tone = habit.tone ?? CATEGORY_APPEARANCE[habit.category].tone;

  return (
    <header className={`habit-hero-card tone-wash--${tone}`}>
      <div className="habit-hero-card__bar">
        <Link
          to="/habits"
          className="icon-button habit-hero-card__back"
          aria-label="Back to habits"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        {onEdit && (
          <button type="button" className="habit-hero-card__edit" onClick={onEdit}>
            <Pencil size={15} aria-hidden="true" /> Edit
          </button>
        )}
      </div>

      <div className="habit-hero-card__identity">
        <CategoryIcon category={habit.category} icon={habit.icon} tone={habit.tone} size="lg" />
        <div className="habit-hero-card__titles">
          <p className="habit-hero-card__eyebrow">
            {ended
              ? `Ended ${relativeDayLabel(habit.archivedOn ?? today, today)}`
              : `${CATEGORY_LABELS[habit.category]} · ${describeSchedule(habit)}`}
          </p>
          <h1 className="habit-hero-card__name">{habit.name}</h1>
        </div>
      </div>

      {habit.description && <p className="habit-hero-card__why">“{habit.description}”</p>}

      <ul className="habit-hero-card__chips" aria-label="At a glance">
        {target && (
          <li className="hero-chip">
            <Target size={13} aria-hidden="true" /> {target}
          </li>
        )}
        {when && (
          <li className="hero-chip">
            <Clock size={13} aria-hidden="true" /> {when}
          </li>
        )}
        {upcoming && (
          <li className="hero-chip hero-chip--accent">
            <CalendarDays size={13} aria-hidden="true" /> Starts{' '}
            {inlineDayLabel(habit.startDate, today)}
          </li>
        )}
        {todayEntry && (
          <li className={`hero-chip hero-chip--${todayEntry.status}`}>
            {todayEntry.minimum ? 'Minimum done today' : TODAY_STATUS[todayEntry.status]}
          </li>
        )}
      </ul>

      {canLogToday && (
        <button type="button" className="habit-hero-card__log" onClick={onLogToday}>
          <PenLine size={18} aria-hidden="true" />
          {todayEntry ? 'Edit today’s entry' : 'Log today'}
        </button>
      )}
    </header>
  );
}
