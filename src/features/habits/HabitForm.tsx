import { Plus, Trash2 } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { TextAreaField, TextField } from '@/components/form';
import { CATEGORY_HINTS, CATEGORY_LABELS, HABIT_CATEGORIES } from '@/domain/categories';
import { WEEKDAY_SHORT, type Habit, type HabitDraft } from '@/domain/habit';
import {
  initialHabitForm,
  useHabitFormSubmit,
  type HabitFormState,
  type ScheduleChoice,
} from './habitFormState';

interface SectionProps {
  state: HabitFormState;
  errors: Record<string, string>;
  update: (patch: Partial<HabitFormState>) => void;
}

export function HabitBasicsFields({ state, errors, update }: SectionProps) {
  return (
    <>
      <TextField
        label="Habit name"
        value={state.name}
        maxLength={80}
        autoComplete="off"
        required
        error={errors.name}
        placeholder="e.g. Gym workout"
        onChange={(e) => {
          update({ name: e.target.value });
        }}
      />
      <fieldset className="fieldset">
        <legend className="field__label">Category</legend>
        <div className="category-grid">
          {HABIT_CATEGORIES.map((category) => (
            <label key={category} className="category-option">
              <input
                type="radio"
                name="habit-category"
                checked={state.category === category}
                onChange={() => {
                  update({ category });
                }}
              />
              <CategoryIcon category={category} size="sm" />
              <span className="category-option__label">{CATEGORY_LABELS[category]}</span>
            </label>
          ))}
        </div>
        <p className="field__hint">{CATEGORY_HINTS[state.category]}</p>
      </fieldset>
      <TextAreaField
        label="Why it matters"
        hint="Optional"
        rows={2}
        maxLength={500}
        value={state.description}
        onChange={(e) => {
          update({ description: e.target.value });
        }}
      />
    </>
  );
}

export function HabitRecoveryFields({ state, errors, update }: SectionProps) {
  return (
    <>
      <TextField
        label="Minimum version"
        hint="Optional. The smallest thing that still counts on a hard day, e.g. “10 minutes” or “1 easy problem”."
        value={state.minimumTarget}
        maxLength={120}
        onChange={(e) => {
          update({ minimumTarget: e.target.value });
        }}
      />
      <label className="switch-field">
        <span>
          <span className="switch-field__label">Allow alternatives</span>
          <span className="field__hint">Mark it done by doing one of these instead.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={state.allowAlternatives}
          onChange={(e) => {
            update({ allowAlternatives: e.target.checked });
          }}
        />
      </label>
      {state.allowAlternatives && (
        <div className="field">
          <ul className="alt-list">
            {state.alternatives.map((alt, index) => (
              <li key={index} className="alt-list__row">
                <input
                  className="input"
                  aria-label={`Alternative ${index + 1}`}
                  value={alt}
                  maxLength={60}
                  onChange={(e) => {
                    const next = [...state.alternatives];
                    next[index] = e.target.value;
                    update({ alternatives: next });
                  }}
                />
                <button
                  type="button"
                  className="icon-button icon-button--plain"
                  aria-label={`Remove alternative ${index + 1}`}
                  onClick={() => {
                    update({ alternatives: state.alternatives.filter((_, i) => i !== index) });
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {state.alternatives.length < 8 && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                update({ alternatives: [...state.alternatives, ''] });
              }}
            >
              <Plus size={16} aria-hidden="true" /> Add alternative
            </button>
          )}
          {errors.alternatives && <p className="field__error">{errors.alternatives}</p>}
        </div>
      )}
    </>
  );
}

const SCHEDULES: readonly { value: ScheduleChoice; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'selected_days', label: 'Specific days' },
  { value: 'weekly', label: 'Once a week' },
];

/** Monday-first display order; values stay 0 = Sunday … 6 = Saturday. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function HabitScheduleFields({ state, errors, update }: SectionProps) {
  return (
    <>
      <fieldset className="fieldset">
        <legend className="field__label">Repeat</legend>
        <div className="choice-row choice-row--wrap">
          {SCHEDULES.map((s) => (
            <label key={s.value} className="choice">
              <input
                type="radio"
                name="habit-schedule"
                checked={state.schedule === s.value}
                onChange={() => {
                  update({ schedule: s.value });
                }}
              />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
        {state.schedule === 'weekly' && (
          <p className="field__hint">Any one day of the week counts.</p>
        )}
      </fieldset>
      {state.schedule === 'selected_days' && (
        <fieldset className="fieldset">
          <legend className="field__label">Days</legend>
          <div className="weekday-picker">
            {WEEKDAY_ORDER.map((day) => (
              <label key={day} className="weekday-chip">
                <input
                  type="checkbox"
                  checked={state.weekdays.includes(day)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    update({
                      weekdays: checked
                        ? [...state.weekdays, day]
                        : state.weekdays.filter((d) => d !== day),
                    });
                  }}
                />
                <span>{WEEKDAY_SHORT[day]}</span>
              </label>
            ))}
          </div>
          {errors.weekdays && <p className="field__error">{errors.weekdays}</p>}
        </fieldset>
      )}
      <div className="form__row">
        <TextField
          label="Target"
          hint="Optional"
          type="number"
          inputMode="decimal"
          min={0}
          value={state.target}
          error={errors.target}
          onChange={(e) => {
            update({ target: e.target.value });
          }}
        />
        <TextField
          label="Unit"
          hint="min, pages, problems…"
          value={state.unit}
          maxLength={20}
          disabled={state.target.trim() === ''}
          onChange={(e) => {
            update({ unit: e.target.value });
          }}
        />
      </div>
    </>
  );
}

interface HabitEditFormProps {
  habit: Habit;
  onSubmit: (draft: HabitDraft) => Promise<void>;
  onCancel: () => void;
}

/** All habit settings on one page, for editing an existing habit. */
export function HabitEditForm({ habit, onSubmit, onCancel }: HabitEditFormProps) {
  const [state, setState] = useState(() => initialHabitForm(habit));
  const { errors, pending, submit } = useHabitFormSubmit(onSubmit);
  const update = (patch: Partial<HabitFormState>) => {
    setState((s) => ({ ...s, ...patch }));
  };
  const handle = (event: SyntheticEvent) => {
    event.preventDefault();
    void submit(state);
  };
  return (
    <form className="form" onSubmit={handle} noValidate>
      <HabitBasicsFields state={state} errors={errors} update={update} />
      <HabitScheduleFields state={state} errors={errors} update={update} />
      <HabitRecoveryFields state={state} errors={errors} update={update} />
      <div className="form__actions">
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={pending}>
          Save changes
        </button>
      </div>
    </form>
  );
}
