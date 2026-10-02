import { useContext, useState, type SyntheticEvent } from 'react';
import { TextAreaField, TextField } from '@/components/form';
import { ToastContext } from '@/components/toast-context';
import { toAppError } from '@/db/errors';
import { WEEKDAY_SHORT, type Habit, type HabitDraft, type HabitFrequency } from '@/domain/habit';
import { issuesByField } from '@/lib/validation';

const FREQUENCIES: readonly { value: HabitFrequency; label: string; hint: string }[] = [
  { value: 'daily', label: 'Every day', hint: 'One check-in per day' },
  { value: 'selected_days', label: 'Specific days', hint: 'Only on the days you choose' },
  { value: 'weekly', label: 'Once a week', hint: 'Any day of the week counts' },
];

/** Monday-first display order; values stay 0 = Sunday … 6 = Saturday. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

interface HabitFormProps {
  initial?: Habit;
  submitLabel: string;
  onSubmit: (draft: HabitDraft) => Promise<void>;
  onCancel: () => void;
}

export function HabitForm({ initial, submitLabel, onSubmit, onCancel }: HabitFormProps) {
  const notify = useContext(ToastContext);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [frequency, setFrequency] = useState<HabitFrequency>(initial?.frequency ?? 'daily');
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? [1, 2, 3, 4, 5]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await onSubmit({ name, description, frequency, weekdays });
    } catch (error) {
      const appError = toAppError(error);
      if (appError.kind === 'validation') setErrors(issuesByField(appError.issues));
      else notify({ kind: 'error', message: appError.message });
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <TextField
        label="Name"
        value={name}
        maxLength={80}
        autoComplete="off"
        required
        error={errors.name}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <TextAreaField
        label="Why it matters"
        hint="Optional"
        rows={2}
        value={description}
        maxLength={500}
        onChange={(e) => {
          setDescription(e.target.value);
        }}
      />
      <fieldset className="fieldset">
        <legend className="field__label">How often</legend>
        {FREQUENCIES.map((option) => (
          <label key={option.value} className="radio-card">
            <input
              type="radio"
              name="frequency"
              value={option.value}
              checked={frequency === option.value}
              onChange={() => {
                setFrequency(option.value);
              }}
            />
            <span className="radio-card__label">{option.label}</span>
            <span className="radio-card__hint">{option.hint}</span>
          </label>
        ))}
      </fieldset>
      {frequency === 'selected_days' && (
        <fieldset className="fieldset">
          <legend className="field__label">Days</legend>
          <div className="weekday-picker">
            {WEEKDAY_ORDER.map((day) => (
              <label key={day} className="weekday-chip">
                <input
                  type="checkbox"
                  checked={weekdays.includes(day)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setWeekdays((current) =>
                      checked ? [...current, day] : current.filter((d) => d !== day),
                    );
                  }}
                />
                <span>{WEEKDAY_SHORT[day]}</span>
              </label>
            ))}
          </div>
          {errors.weekdays && <p className="field__error">{errors.weekdays}</p>}
        </fieldset>
      )}
      <div className="form__actions">
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={pending}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
