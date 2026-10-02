import { useState, type SyntheticEvent } from 'react';
import { Dialog } from '@/components/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/form';
import { TagInput } from '@/components/TagInput';
import { setHabitStatus } from '@/db/repositories/habits';
import { LOG_FIELDS, type ActivityLog, type LogField } from '@/domain/activityLog';
import { describeTarget, type Habit, type HabitEntry, type HabitStatus } from '@/domain/habit';
import { useAction } from '@/hooks/useAction';
import { relativeDayLabel } from '@/lib/format';

type Choice = 'completed' | 'minimum' | 'skipped' | 'missed';

const CHOICE_LABELS: Record<Choice, string> = {
  completed: 'Done',
  minimum: 'Did the minimum',
  skipped: 'Skipped',
  missed: 'Missed',
};

interface HabitLogSheetProps {
  habit: Habit;
  date: string;
  today: string;
  entry?: HabitEntry | undefined;
  onClose: () => void;
}

function initialChoice(entry: HabitEntry | undefined): Choice {
  if (!entry) return 'completed';
  if (entry.status === 'completed' && entry.minimum) return 'minimum';
  return entry.status;
}

/**
 * Record a habit for one date. Only the status is needed; the amount, alternative, notes,
 * activity details, and tags are optional. Also used to correct or clear a mistaken entry.
 */
export function HabitLogSheet({ habit, date, today, entry, onClose }: HabitLogSheetProps) {
  const { run, pending } = useAction();
  const [choice, setChoice] = useState<Choice>(initialChoice(entry));
  const [amount, setAmount] = useState(entry?.amount?.toString() ?? '');
  const [alternative, setAlternative] = useState(entry?.alternative ?? '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [log, setLog] = useState<ActivityLog>(entry?.log ?? {});
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [confirmClear, setConfirmClear] = useState(false);
  const fields = LOG_FIELDS[habit.category];
  const target = describeTarget(habit);
  const choices: Choice[] = habit.minimumTarget
    ? ['completed', 'minimum', 'skipped', 'missed']
    : ['completed', 'skipped', 'missed'];
  const hasDetails =
    entry !== undefined &&
    (entry.log !== undefined || entry.note !== undefined || entry.tags.length > 0);

  const save = async (event: SyntheticEvent) => {
    event.preventDefault();
    const status: HabitStatus = choice === 'minimum' ? 'completed' : choice;
    const done = status === 'completed';
    const result = await run(
      () =>
        setHabitStatus(habit.id, date, status, {
          note,
          amount: done && amount.trim() !== '' ? Number(amount) : undefined,
          minimum: choice === 'minimum',
          alternative: done ? alternative : undefined,
          log: done ? log : undefined,
          tags,
        }),
      'Saved',
    );
    if (result.ok) onClose();
  };

  const clear = async () => {
    const result = await run(() => setHabitStatus(habit.id, date, null), 'Entry cleared');
    if (result.ok) onClose();
  };

  return (
    <Dialog open title={habit.name} onClose={onClose}>
      <p className="muted small">{relativeDayLabel(date, today)}</p>
      <form className="form" onSubmit={(e) => void save(e)}>
        <fieldset className="fieldset">
          <legend className="visually-hidden">Status</legend>
          <div className="choice-row choice-row--grid">
            {choices.map((c) => (
              <label key={c} className={`choice choice--${c}`}>
                <input
                  type="radio"
                  name="habit-status"
                  checked={choice === c}
                  onChange={() => {
                    setChoice(c);
                  }}
                />
                <span>{CHOICE_LABELS[c]}</span>
              </label>
            ))}
          </div>
          {choice === 'minimum' && habit.minimumTarget && (
            <p className="field__hint">Minimum: {habit.minimumTarget}. It counts.</p>
          )}
          {choice === 'missed' && (
            <p className="field__hint">
              Recording it honestly is useful. A new day is a fresh start.
            </p>
          )}
        </fieldset>

        {(choice === 'completed' || choice === 'minimum') && (
          <>
            {habit.alternatives && habit.alternatives.length > 0 && (
              <SelectField
                label="What did you do?"
                value={alternative}
                options={[
                  { value: '', label: habit.name },
                  ...habit.alternatives.map((a) => ({ value: a, label: a })),
                ]}
                onChange={(e) => {
                  setAlternative(e.target.value);
                }}
              />
            )}
            {target && (
              <TextField
                label={`Amount${habit.unit ? ` (${habit.unit})` : ''}`}
                hint={`Target: ${target}. Optional.`}
                type="number"
                inputMode="decimal"
                min={0}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                }}
              />
            )}
            <details className="disclosure" open={entry?.log !== undefined}>
              <summary className="disclosure__summary">Add details</summary>
              <div className="form disclosure__body">
                {fields.map((field) => (
                  <LogFieldInput
                    key={field.key}
                    field={field}
                    value={log[field.key]}
                    onChange={(value) => {
                      setLog((current) => {
                        const rest = Object.fromEntries(
                          Object.entries(current).filter(([key]) => key !== field.key),
                        );
                        return value === undefined ? rest : { ...rest, [field.key]: value };
                      });
                    }}
                  />
                ))}
              </div>
            </details>
          </>
        )}

        <TextAreaField
          label={choice === 'missed' || choice === 'skipped' ? 'What got in the way?' : 'Note'}
          hint="Optional"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
        />
        <TagInput label="Tags" tags={tags} onChange={setTags} />

        <div className="form__actions form__actions--split">
          {entry ? (
            confirmClear ? (
              <button
                type="button"
                className="button button--danger button--compact"
                onClick={() => void clear()}
              >
                Clear entry and details
              </button>
            ) : (
              <button
                type="button"
                className="button button--secondary button--compact"
                disabled={pending}
                onClick={() => {
                  if (hasDetails) setConfirmClear(true);
                  else void clear();
                }}
              >
                Clear entry
              </button>
            )
          ) : (
            <span />
          )}
          <button type="submit" className="button button--primary" disabled={pending}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function LogFieldInput({
  field,
  value,
  onChange,
}: {
  field: LogField;
  value: string | number | undefined;
  onChange: (value: string | number | undefined) => void;
}) {
  const label = field.unit ? `${field.label} (${field.unit})` : field.label;
  if (field.kind === 'number') {
    return (
      <TextField
        label={label}
        type="number"
        inputMode="decimal"
        min={0}
        value={value ?? ''}
        onChange={(e) => {
          onChange(e.target.value === '' ? undefined : Number(e.target.value));
        }}
      />
    );
  }
  if (field.kind === 'select') {
    return (
      <SelectField
        label={label}
        value={typeof value === 'string' ? value : ''}
        options={[
          { value: '', label: 'Choose…' },
          ...(field.options ?? []).map((o) => ({ value: o, label: o })),
        ]}
        onChange={(e) => {
          onChange(e.target.value === '' ? undefined : e.target.value);
        }}
      />
    );
  }
  const common = {
    label,
    value: typeof value === 'string' ? value : '',
    placeholder: field.placeholder,
  };
  return field.kind === 'longtext' ? (
    <TextAreaField
      {...common}
      rows={2}
      maxLength={5000}
      onChange={(e) => {
        onChange(e.target.value === '' ? undefined : e.target.value);
      }}
    />
  ) : (
    <TextField
      {...common}
      maxLength={500}
      onChange={(e) => {
        onChange(e.target.value === '' ? undefined : e.target.value);
      }}
    />
  );
}
