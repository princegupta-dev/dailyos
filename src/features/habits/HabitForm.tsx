import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Feather,
  Lightbulb,
  Minus,
  Moon,
  Plus,
  Repeat,
  Shuffle,
  Sun,
  Sunrise,
  Sunset,
  Target,
  Trash2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, type SyntheticEvent } from 'react';
import { CategoryIcon, HABIT_ICON_COMPONENTS } from '@/components/CategoryIcon';
import { TextAreaField, TextField } from '@/components/form';
import {
  HABIT_ICONS,
  HABIT_TONES,
  ICON_LABELS,
  TIME_OF_DAY_LABELS,
  TIMES_OF_DAY,
  TONE_LABELS,
  type TimeOfDay,
} from '@/domain/appearance';
import {
  CATEGORY_APPEARANCE,
  CATEGORY_GROUPS,
  CATEGORY_HINTS,
  CATEGORY_IDEAS,
  CATEGORY_LABELS,
  CATEGORY_UNITS,
} from '@/domain/categories';
import { WEEKDAY_SHORT, type Habit, type HabitDraft } from '@/domain/habit';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { addDays, formatDateKey, startOfWeek } from '@/lib/dates';
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

/* ---------- Details ---------- */

export function HabitBasicsFields({ state, errors, update }: SectionProps) {
  const ideas = CATEGORY_IDEAS[state.category];
  return (
    <>
      <div className="wizard-card">
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
        <div className="idea-row">
          <span className="idea-row__label">
            <Lightbulb size={13} aria-hidden="true" /> Ideas
          </span>
          {ideas.map((idea) => (
            <button
              key={idea}
              type="button"
              className="idea-chip"
              aria-pressed={state.name === idea}
              onClick={() => {
                update({ name: idea });
              }}
            >
              {idea}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="fieldset wizard-card">
        <legend className="wizard-card__legend">Category</legend>
        <p className="wizard-card__hint">Where does this habit belong?</p>
        {CATEGORY_GROUPS.map((group) => (
          <div key={group.label} className="category-group">
            <p className="category-group__label" aria-hidden="true">
              {group.label}
            </p>
            <div className="category-grid">
              {group.categories.map((category) => (
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
          </div>
        ))}
        <p className="field__hint category-hint">{CATEGORY_HINTS[state.category]}</p>
      </fieldset>

      <AppearanceFields state={state} update={update} />

      <div className="wizard-card">
        <TextAreaField
          label="Why it matters"
          hint="Optional. A line to come back to on hard days."
          rows={2}
          maxLength={500}
          placeholder="So I have energy for the people I love…"
          value={state.description}
          onChange={(e) => {
            update({ description: e.target.value });
          }}
        />
      </div>
    </>
  );
}

/** The habit's own icon and color, with the category's as the default. */
function AppearanceFields({ state, update }: Pick<SectionProps, 'state' | 'update'>) {
  const defaults = CATEGORY_APPEARANCE[state.category];
  return (
    <fieldset className="fieldset wizard-card appearance">
      <legend className="wizard-card__legend">Look</legend>
      <div className="appearance__stage">
        <CategoryIcon category={state.category} icon={state.icon} tone={state.tone} size="lg" />
        <p className="wizard-card__hint">
          Give it a face you’ll recognize at a glance. It starts with the {''}
          {CATEGORY_LABELS[state.category].toLowerCase()} look.
        </p>
      </div>

      <div className="appearance__group" role="radiogroup" aria-label="Icon">
        <p className="appearance__label" aria-hidden="true">
          Icon
        </p>
        <div className="icon-grid">
          <label className="icon-option" title="Category icon">
            <input
              type="radio"
              name="habit-icon"
              aria-label="Category icon"
              checked={state.icon === undefined}
              onChange={() => {
                update({ icon: undefined });
              }}
            />
            <Sparkles size={18} aria-hidden="true" />
          </label>
          {HABIT_ICONS.map((key) => {
            const Icon = HABIT_ICON_COMPONENTS[key];
            return (
              <label key={key} className="icon-option" title={ICON_LABELS[key]}>
                <input
                  type="radio"
                  name="habit-icon"
                  aria-label={`${ICON_LABELS[key]} icon`}
                  checked={state.icon === key}
                  onChange={() => {
                    update({ icon: key });
                  }}
                />
                <Icon size={18} aria-hidden="true" />
              </label>
            );
          })}
        </div>
      </div>

      <div className="appearance__group" role="radiogroup" aria-label="Color">
        <p className="appearance__label" aria-hidden="true">
          Color
        </p>
        <div className="tone-row">
          <label className="tone-option" title="Category color">
            <input
              type="radio"
              name="habit-tone"
              aria-label="Category color"
              checked={state.tone === undefined}
              onChange={() => {
                update({ tone: undefined });
              }}
            />
            <span className={`tone-option__swatch tone--${defaults.tone}`} aria-hidden="true">
              <Sparkles size={13} />
            </span>
          </label>
          {HABIT_TONES.map((tone) => (
            <label key={tone} className="tone-option" title={TONE_LABELS[tone]}>
              <input
                type="radio"
                name="habit-tone"
                aria-label={`${TONE_LABELS[tone]} color`}
                checked={state.tone === tone}
                onChange={() => {
                  update({ tone });
                }}
              />
              <span className={`tone-option__swatch tone--${tone}`} aria-hidden="true" />
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

/* ---------- Flexibility ---------- */

const MINIMUM_IDEAS = ['5 minutes', 'One small step', 'Just show up'];

export function HabitRecoveryFields({ state, errors, update }: SectionProps) {
  const target = state.target.trim();
  const fullGoal = target === '' ? 'The full habit' : `${target} ${state.unit.trim()}`.trim();
  const alternatives = state.alternatives.map((a) => a.trim()).filter((a) => a !== '');
  return (
    <>
      {/* What counts as done, built from what's been chosen so far. */}
      <div className="wizard-card completion-rule">
        <p className="wizard-card__legend">What counts as done</p>
        <ol className="completion-rule__tiers">
          <li className="completion-rule__tier completion-rule__tier--on">
            <span className="completion-rule__icon" aria-hidden="true">
              <Target size={15} />
            </span>
            <span>
              <span className="completion-rule__name">Best day</span>
              <span className="completion-rule__value">{fullGoal}</span>
            </span>
          </li>
          <li
            className={`completion-rule__tier${state.minimumTarget.trim() !== '' ? ' completion-rule__tier--on' : ''}`}
          >
            <span className="completion-rule__icon" aria-hidden="true">
              <Feather size={15} />
            </span>
            <span>
              <span className="completion-rule__name">Hard day</span>
              <span className="completion-rule__value">
                {state.minimumTarget.trim() || 'No minimum yet'}
              </span>
            </span>
          </li>
          <li
            className={`completion-rule__tier${state.allowAlternatives && alternatives.length > 0 ? ' completion-rule__tier--on' : ''}`}
          >
            <span className="completion-rule__icon" aria-hidden="true">
              <Shuffle size={15} />
            </span>
            <span>
              <span className="completion-rule__name">Different day</span>
              <span className="completion-rule__value">
                {state.allowAlternatives && alternatives.length > 0
                  ? alternatives.join(', ')
                  : 'No alternatives yet'}
              </span>
            </span>
          </li>
        </ol>
      </div>

      <div className="wizard-card">
        <TextField
          label="Minimum version"
          hint="Optional. The smallest thing that still counts on a hard day, e.g. “10 minutes” or “1 easy problem”."
          value={state.minimumTarget}
          maxLength={120}
          onChange={(e) => {
            update({ minimumTarget: e.target.value });
          }}
        />
        <div className="idea-row">
          {MINIMUM_IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              className="idea-chip"
              aria-pressed={state.minimumTarget === idea}
              onClick={() => {
                update({ minimumTarget: idea });
              }}
            >
              {idea}
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-card">
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
          <div className="field alternatives">
            {state.alternatives.length === 0 && (
              <p className="field__hint alternatives__empty">
                E.g. “Running” for a gym habit, or “Audiobook” for reading.
              </p>
            )}
            <ul className="alt-list">
              {state.alternatives.map((alt, index) => (
                <li key={index} className="alt-list__row">
                  <span className="alt-list__index" aria-hidden="true">
                    {index + 1}
                  </span>
                  <input
                    className="input"
                    aria-label={`Alternative ${index + 1}`}
                    value={alt}
                    maxLength={60}
                    placeholder="Another way to do it"
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
      </div>
    </>
  );
}

/* ---------- Schedule ---------- */

const SCHEDULES: readonly {
  value: ScheduleChoice;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { value: 'daily', label: 'Every day', hint: 'Seven days a week', icon: Repeat },
  { value: 'weekdays', label: 'Weekdays', hint: 'Monday to Friday', icon: CalendarRange },
  {
    value: 'selected_days',
    label: 'Specific days',
    hint: 'You pick the days',
    icon: CalendarCheck,
  },
  { value: 'weekly', label: 'Once a week', hint: 'Any one day counts', icon: CalendarClock },
];

/** Monday-first display order; values stay 0 = Sunday … 6 = Saturday. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const TIME_ICONS: Record<TimeOfDay, LucideIcon> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
};

const CUE_IDEAS = ['After coffee', 'After lunch', 'After work', 'Before bed'];

interface ScheduleProps extends SectionProps {
  /** Creation shows when the habit starts; editing can't move the start. */
  mode?: 'create' | 'edit';
}

export function HabitScheduleFields({ state, errors, update, mode = 'edit' }: ScheduleProps) {
  const hintId = useId();
  return (
    <>
      <fieldset className="fieldset wizard-card">
        <legend className="wizard-card__legend">Repeat</legend>
        <div className="schedule-grid">
          {SCHEDULES.map((s) => {
            const Icon = s.icon;
            return (
              <label key={s.value} className="schedule-option">
                <input
                  type="radio"
                  name="habit-schedule"
                  aria-describedby={`${hintId}-${s.value}`}
                  checked={state.schedule === s.value}
                  onChange={() => {
                    update({ schedule: s.value });
                  }}
                />
                <span className="schedule-option__icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="schedule-option__label">{s.label}</span>
                <span
                  id={`${hintId}-${s.value}`}
                  className="schedule-option__hint"
                  aria-hidden="true"
                >
                  {s.hint}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {state.schedule === 'selected_days' && (
        <fieldset className="fieldset wizard-card wizard-card--reveal">
          <legend className="wizard-card__legend">Days</legend>
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

      <GoalFields state={state} errors={errors} update={update} />

      {mode === 'create' && <StartFields state={state} errors={errors} update={update} />}

      <WhenFields state={state} errors={errors} update={update} />
    </>
  );
}

/** Target and unit, with a stepper, unit suggestions, and the goal read back as a sentence. */
function GoalFields({ state, errors, update }: SectionProps) {
  const value = Number(state.target);
  const hasTarget = state.target.trim() !== '' && Number.isFinite(value) && value > 0;
  const step = (delta: number) => {
    const current = Number.isFinite(value) ? value : 0;
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    update({ target: next === 0 ? '' : String(next) });
  };
  const per =
    state.schedule === 'weekly'
      ? 'each week'
      : state.schedule === 'daily'
        ? 'every day'
        : 'each time';
  return (
    <div className="wizard-card goal">
      <p className="wizard-card__legend">
        <Target size={15} aria-hidden="true" /> Goal
      </p>
      <div className="goal__row">
        <div className="goal__target">
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
          <div className="stepper-buttons">
            <button
              type="button"
              className="stepper-button"
              aria-label="Decrease target"
              disabled={!hasTarget}
              onClick={() => {
                step(-1);
              }}
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="stepper-button"
              aria-label="Increase target"
              onClick={() => {
                step(1);
              }}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
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
      {hasTarget && (
        <div className="idea-row">
          {CATEGORY_UNITS[state.category].map((unit) => (
            <button
              key={unit}
              type="button"
              className="idea-chip"
              aria-pressed={state.unit === unit}
              onClick={() => {
                update({ unit });
              }}
            >
              {unit}
            </button>
          ))}
        </div>
      )}
      <p className="goal__sentence" aria-live="polite">
        {hasTarget ? (
          <>
            Aim for <strong>{`${state.target} ${state.unit}`.trim()}</strong> {per}.
          </>
        ) : (
          'No target: doing it at all counts. You can add one later.'
        )}
      </p>
    </div>
  );
}

type StartChoice = 'today' | 'tomorrow' | 'next_week' | 'custom';

/** The first day the habit counts. Never in the past, so no day starts out missed. */
function StartFields({ state, errors, update }: SectionProps) {
  const today = useToday();
  const weekStartsOn = useWeekStartsOn();
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(startOfWeek(today, weekStartsOn), 7);
  const [custom, setCustom] = useState(false);
  const chosen: StartChoice = custom
    ? 'custom'
    : state.startDate === '' || state.startDate === today
      ? 'today'
      : state.startDate === tomorrow
        ? 'tomorrow'
        : state.startDate === nextWeek
          ? 'next_week'
          : 'custom';

  const options: readonly { value: StartChoice; label: string; date?: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow', date: tomorrow },
    {
      value: 'next_week',
      label: `Next ${formatDateKey(nextWeek, undefined, { weekday: 'long' })}`,
      date: nextWeek,
    },
    { value: 'custom', label: 'Pick a date' },
  ];

  return (
    <fieldset className="fieldset wizard-card">
      <legend className="wizard-card__legend">
        <CalendarDays size={15} aria-hidden="true" /> Starts
      </legend>
      <div className="choice-row choice-row--wrap">
        {options.map((o) => (
          <label key={o.value} className="choice">
            <input
              type="radio"
              name="habit-start"
              checked={chosen === o.value}
              onChange={() => {
                setCustom(o.value === 'custom');
                if (o.value === 'today') update({ startDate: '' });
                else if (o.value === 'custom') update({ startDate: state.startDate || tomorrow });
                else update({ startDate: o.date ?? '' });
              }}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {chosen === 'custom' && (
        <TextField
          label="Start date"
          type="date"
          min={today}
          value={state.startDate || tomorrow}
          error={errors.startDate}
          onChange={(e) => {
            update({ startDate: e.target.value });
          }}
        />
      )}
      {chosen !== 'custom' && errors.startDate && (
        <p className="field__error">{errors.startDate}</p>
      )}
    </fieldset>
  );
}

/** When it usually happens and what it follows: an anchor shown on the habit. */
function WhenFields({ state, errors, update }: SectionProps) {
  return (
    <fieldset className="fieldset wizard-card when">
      <legend className="wizard-card__legend">
        <Moon size={15} aria-hidden="true" /> When
      </legend>
      <div className="time-grid">
        <label className="time-option">
          <input
            type="radio"
            name="habit-time"
            checked={state.timeOfDay === undefined}
            onChange={() => {
              update({ timeOfDay: undefined });
            }}
          />
          <span className="time-option__icon" aria-hidden="true">
            <Repeat size={16} />
          </span>
          <span>Anytime</span>
        </label>
        {TIMES_OF_DAY.map((time) => {
          const Icon = TIME_ICONS[time];
          return (
            <label key={time} className={`time-option time-option--${time}`}>
              <input
                type="radio"
                name="habit-time"
                checked={state.timeOfDay === time}
                onChange={() => {
                  update({ timeOfDay: time });
                }}
              />
              <span className="time-option__icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span>{TIME_OF_DAY_LABELS[time]}</span>
            </label>
          );
        })}
      </div>
      <TextField
        label="Cue"
        hint="Optional. What it follows, so it has a home in your day."
        value={state.cue}
        maxLength={80}
        autoComplete="off"
        placeholder="After coffee"
        error={errors.cue}
        onChange={(e) => {
          update({ cue: e.target.value });
        }}
      />
      <div className="idea-row">
        {CUE_IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            className="idea-chip"
            aria-pressed={state.cue === idea}
            onClick={() => {
              update({ cue: idea });
            }}
          >
            {idea}
          </button>
        ))}
      </div>
      <p className="when__note">
        DailyOS doesn’t send notifications. The time and cue show on the habit as a gentle anchor.
      </p>
    </fieldset>
  );
}

/* ---------- Editing ---------- */

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
    <form className="form wizard-form" onSubmit={handle} noValidate>
      <HabitBasicsFields state={state} errors={errors} update={update} />
      <HabitScheduleFields state={state} errors={errors} update={update} mode="edit" />
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
