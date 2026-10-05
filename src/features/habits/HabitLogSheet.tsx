import {
  Check,
  CircleSlash,
  Feather,
  Heart,
  Leaf,
  ListPlus,
  SkipForward,
  Target,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, type SyntheticEvent } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Dialog } from '@/components/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/form';
import { TagInput } from '@/components/TagInput';
import { setHabitStatus } from '@/db/repositories/habits';
import { LOG_FIELDS, type ActivityLog, type LogField } from '@/domain/activityLog';
import {
  describeSchedule,
  describeTarget,
  type Habit,
  type HabitEntry,
  type HabitStatus,
} from '@/domain/habit';
import { useAction } from '@/hooks/useAction';
import { relativeDayLabel } from '@/lib/format';

type Choice = 'completed' | 'minimum' | 'skipped' | 'missed';

const CHOICES: Record<Choice, { label: string; hint: string; icon: LucideIcon }> = {
  completed: { label: 'Done', hint: 'Counts toward your streak', icon: Check },
  minimum: { label: 'Did the minimum', hint: 'The hard-day version', icon: Feather },
  skipped: { label: 'Skipped', hint: 'Never counts against you', icon: SkipForward },
  missed: { label: 'Missed', hint: 'Honest, and that’s fine', icon: CircleSlash },
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
  const hintId = useId();
  const fields = LOG_FIELDS[habit.category];
  const target = describeTarget(habit);
  const choices: Choice[] = habit.minimumTarget
    ? ['completed', 'minimum', 'skipped', 'missed']
    : ['completed', 'skipped', 'missed'];
  const hasDetails =
    entry !== undefined &&
    (entry.log !== undefined || entry.note !== undefined || entry.tags.length > 0);
  const done = choice === 'completed' || choice === 'minimum';
  const amountValue = Number(amount);
  const progress =
    habit.target !== undefined && amount.trim() !== '' && amountValue >= 0
      ? Math.min(amountValue / habit.target, 1)
      : null;

  const save = async (event: SyntheticEvent) => {
    event.preventDefault();
    const status: HabitStatus = choice === 'minimum' ? 'completed' : choice;
    const completed = status === 'completed';
    const result = await run(
      () =>
        setHabitStatus(habit.id, date, status, {
          note,
          amount: completed && amount.trim() !== '' ? Number(amount) : undefined,
          minimum: choice === 'minimum',
          alternative: completed ? alternative : undefined,
          log: completed ? log : undefined,
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
    <Dialog open title={habit.name} description={relativeDayLabel(date, today)} onClose={onClose}>
      <div className="log-sheet">
        <div className="log-sheet__identity">
          <CategoryIcon category={habit.category} icon={habit.icon} tone={habit.tone} />
          <ul className="log-sheet__facts" aria-label="About this habit">
            <li>{describeSchedule(habit)}</li>
            {target && (
              <li>
                <Target size={12} aria-hidden="true" /> {target}
              </li>
            )}
            {entry && <li className="log-sheet__fact--logged">Logged · editing</li>}
          </ul>
        </div>

        <form className="form log-sheet__form" onSubmit={(e) => void save(e)}>
          <fieldset className="fieldset">
            <legend className="log-sheet__legend">How did it go?</legend>
            <div className={`log-choices${choices.length === 3 ? ' log-choices--three' : ''}`}>
              {choices.map((c) => {
                const { label, hint, icon: Icon } = CHOICES[c];
                const descId = `${hintId}-${c}`;
                return (
                  <label key={c} className={`log-choice log-choice--${c}`}>
                    <input
                      type="radio"
                      name="habit-status"
                      checked={choice === c}
                      aria-describedby={descId}
                      onChange={() => {
                        setChoice(c);
                      }}
                    />
                    <span className="log-choice__icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={2.25} />
                    </span>
                    <span className="log-choice__label">{label}</span>
                    <span id={descId} className="log-choice__hint" aria-hidden="true">
                      {hint}
                    </span>
                  </label>
                );
              })}
            </div>
            <div id={hintId} className="log-sheet__hint-slot" aria-live="polite">
              {choice === 'minimum' && habit.minimumTarget && (
                <p className="log-hint log-hint--minimum">
                  <Feather size={15} aria-hidden="true" />
                  <span>
                    Minimum: <em>{habit.minimumTarget}</em>. It counts.
                  </span>
                </p>
              )}
              {choice === 'missed' && (
                <p className="log-hint log-hint--missed">
                  <Heart size={15} aria-hidden="true" />
                  <span>
                    Recording it honestly is useful. <em>A new day is a fresh start.</em>
                  </span>
                </p>
              )}
              {choice === 'skipped' && (
                <p className="log-hint log-hint--skipped">
                  <Leaf size={15} aria-hidden="true" />
                  <span>Rest is part of the plan. Your streak is safe.</span>
                </p>
              )}
            </div>
          </fieldset>

          {done && (
            <div className="log-sheet__done">
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
                <div className="log-amount">
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
                  {progress !== null && (
                    <div className="log-amount__meter">
                      <span
                        className={`log-amount__bar${progress >= 1 ? ' log-amount__bar--met' : ''}`}
                        role="img"
                        aria-label={`${Math.round(progress * 100)}% of target`}
                      >
                        <span style={{ inlineSize: `${Math.round(progress * 100)}%` }} />
                      </span>
                      <span className="log-amount__value" aria-hidden="true">
                        {progress >= 1 ? 'Target met' : `${Math.round(progress * 100)}%`}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {fields.length > 0 && (
                <details className="disclosure log-details" open={entry?.log !== undefined}>
                  <summary className="disclosure__summary">
                    <ListPlus size={16} aria-hidden="true" />
                    Add details
                  </summary>
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
              )}
            </div>
          )}

          <div className="log-sheet__journal">
            <TextAreaField
              label={choice === 'missed' || choice === 'skipped' ? 'What got in the way?' : 'Note'}
              hint="Optional"
              rows={2}
              maxLength={500}
              placeholder={
                choice === 'missed' || choice === 'skipped'
                  ? 'A busy day, travel, low energy…'
                  : 'How it felt, what helped…'
              }
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
              }}
            />
            <TagInput label="Tags" tags={tags} onChange={setTags} />
          </div>

          <div className="log-sheet__actions">
            {entry ? (
              confirmClear ? (
                <span className="log-sheet__confirm">
                  <button
                    type="button"
                    className="button button--danger button--compact"
                    onClick={() => void clear()}
                  >
                    <Trash2 size={15} aria-hidden="true" /> Clear entry and details
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--plain"
                    aria-label="Keep entry"
                    onClick={() => {
                      setConfirmClear(false);
                    }}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </span>
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
            <button
              type="submit"
              className={`button button--primary log-sheet__save log-sheet__save--${choice}`}
              disabled={pending}
            >
              <Check size={17} strokeWidth={2.5} aria-hidden="true" />
              Save
            </button>
          </div>
        </form>
      </div>
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
