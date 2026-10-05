import { CalendarDays, Clock, Feather, Repeat, Shuffle, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { describeWhen } from '@/domain/appearance';
import { CATEGORY_LABELS } from '@/domain/categories';
import { describeSchedule, describeTarget } from '@/domain/habit';
import { inlineDayLabel } from '@/lib/format';
import { toHabitDraft, type HabitFormState } from './habitFormState';

interface HabitPreviewProps {
  state: HabitFormState;
  today: string;
  /** `compact` shows only the habit's tile and name, for small screens mid-wizard. */
  variant?: 'full' | 'compact';
}

/**
 * The habit as it will look, updating as the wizard is filled in. Built from the same draft
 * the habit is saved from, so what you see is what you get.
 */
export function HabitPreview({ state, today, variant = 'full' }: HabitPreviewProps) {
  const draft = toHabitDraft(state);
  const name = state.name.trim();
  const schedule = describeSchedule({
    frequency: draft.frequency,
    weekdays: draft.weekdays,
  });
  const target = state.target.trim() === '' ? undefined : Number(state.target);
  const goal =
    target !== undefined && Number.isFinite(target) && target > 0
      ? describeTarget({ target, unit: state.unit.trim() || undefined })
      : undefined;
  const when = describeWhen({ timeOfDay: state.timeOfDay, cue: state.cue.trim() || undefined });
  const alternatives = state.allowAlternatives
    ? state.alternatives.map((a) => a.trim()).filter((a) => a !== '')
    : [];
  const minimum = state.minimumTarget.trim();
  const starts =
    state.startDate === '' || state.startDate === today
      ? 'Today'
      : capitalize(inlineDayLabel(state.startDate, today));

  return (
    <div className={`habit-preview habit-preview--${variant}`}>
      <div className="habit-preview__head">
        <CategoryIcon
          category={state.category}
          icon={state.icon}
          tone={state.tone}
          size={variant === 'compact' ? 'md' : 'lg'}
        />
        <div className="habit-preview__titles">
          <p className="habit-preview__eyebrow">{CATEGORY_LABELS[state.category]}</p>
          <p className={`habit-preview__name${name === '' ? ' habit-preview__name--empty' : ''}`}>
            {name === '' ? 'Your new habit' : name}
          </p>
        </div>
      </div>

      {variant === 'full' && (
        <>
          <ul className="habit-preview__facts">
            <Fact icon={<Repeat size={14} />} label="Repeats" value={schedule || 'Choose days'} />
            <Fact icon={<Target size={14} />} label="Goal" value={goal ?? 'Just do it'} />
            <Fact icon={<Clock size={14} />} label="When" value={when ?? 'Anytime'} />
            <Fact icon={<CalendarDays size={14} />} label="Starts" value={starts} />
          </ul>
          {(minimum !== '' || alternatives.length > 0) && (
            <div className="habit-preview__flex">
              <p className="habit-preview__flex-title">Also counts as done</p>
              {minimum !== '' && (
                <p className="habit-preview__flex-row">
                  <Feather size={13} aria-hidden="true" />
                  <span>
                    Minimum: <em>{minimum}</em>
                  </span>
                </p>
              )}
              {alternatives.length > 0 && (
                <p className="habit-preview__flex-row">
                  <Shuffle size={13} aria-hidden="true" />
                  <span>
                    Or: <em>{alternatives.join(', ')}</em>
                  </span>
                </p>
              )}
            </div>
          )}
          {state.description.trim() !== '' && (
            <p className="habit-preview__why">“{state.description.trim()}”</p>
          )}
        </>
      )}
    </div>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <li className="habit-preview__fact">
      <span className="habit-preview__fact-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="habit-preview__fact-label">{label}</span>
      <span className="habit-preview__fact-value">{value}</span>
    </li>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
