import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Feather,
  PenLine,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useState, type CSSProperties, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { createHabit } from '@/db/repositories/habits';
import { useAction } from '@/hooks/useAction';
import { useToday } from '@/hooks/useToday';
import { HabitBasicsFields, HabitRecoveryFields, HabitScheduleFields } from './HabitForm';
import {
  initialHabitForm,
  STEP_FIELDS,
  useHabitFormSubmit,
  type HabitFormState,
} from './habitFormState';
import { HabitPreview } from './HabitPreview';

const STEPS: readonly { label: string; subtitle: string; icon: LucideIcon }[] = [
  { label: 'Details', subtitle: 'Name it, place it, give it a look.', icon: PenLine },
  { label: 'Flexibility', subtitle: 'Decide what still counts on harder days.', icon: Feather },
  {
    label: 'Schedule',
    subtitle: 'Choose when it happens and what you aim for.',
    icon: CalendarDays,
  },
];

/** Three short steps; only the name is required. Everything else has sensible defaults. */
export function NewHabitPage() {
  const navigate = useNavigate();
  const today = useToday();
  const { notify } = useAction();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<HabitFormState>(() => initialHabitForm());
  const { errors, setErrors, pending, submit } = useHabitFormSubmit(async (draft) => {
    const habit = await createHabit(draft);
    notify({ kind: 'success', message: 'Habit created' });
    void navigate(`/habits/${habit.id}`, { replace: true });
  });
  const update = (patch: Partial<HabitFormState>) => {
    setState((s) => ({ ...s, ...patch }));
  };

  const next = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (step === 0 && state.name.trim() === '') {
      setErrors({ name: 'Name is required' });
      return;
    }
    if (step < STEPS.length - 1) {
      setErrors({});
      setStep(step + 1);
      return;
    }
    const fieldErrors = await submit(state);
    const errorStep = STEP_FIELDS.findIndex((fields) => fields.some((f) => fieldErrors[f]));
    if (errorStep >= 0) setStep(errorStep);
  };

  const last = step === STEPS.length - 1;
  const current = STEPS[step] ?? { label: '', subtitle: '' };
  const sectionProps = { state, errors, update };
  return (
    <div className="habit-wizard">
      <PageHeader
        title="Create habit"
        leading={
          <button
            type="button"
            className="icon-button"
            aria-label={step === 0 ? 'Cancel' : 'Back'}
            onClick={() => {
              if (step === 0) void navigate(-1);
              else setStep(step - 1);
            }}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        }
      />

      <ol
        className="wizard-steps"
        aria-label="Steps"
        style={{ '--wizard-progress': step / (STEPS.length - 1) } as CSSProperties}
      >
        {STEPS.map(({ label, icon: Icon }, index) => {
          const done = index < step;
          const content = (
            <>
              <span className="wizard-steps__dot" aria-hidden="true">
                {done ? <Check size={16} strokeWidth={2.5} /> : <Icon size={16} />}
              </span>
              <span className="wizard-steps__label">{label}</span>
            </>
          );
          return (
            <li
              key={label}
              className={`wizard-steps__step${index === step ? ' wizard-steps__step--current' : ''}${done ? ' wizard-steps__step--done' : ''}`}
              aria-current={index === step ? 'step' : undefined}
            >
              {done ? (
                // Earlier steps can be revisited; later ones open through Next.
                <button
                  type="button"
                  className="wizard-steps__button"
                  aria-label={`Back to ${label}`}
                  onClick={() => {
                    setStep(index);
                  }}
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>

      <div className="habit-wizard__layout">
        <form className="form wizard-form" onSubmit={(e) => void next(e)} noValidate>
          <div className="habit-wizard__compact-preview">
            <HabitPreview state={state} today={today} variant="compact" />
          </div>

          <div key={step} className="wizard-step">
            <div className="wizard-step__head">
              <p className="wizard-step__count">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="step-title">{current.label}</h2>
              <p className="wizard-step__subtitle">{current.subtitle}</p>
            </div>
            {step === 0 && <HabitBasicsFields {...sectionProps} />}
            {step === 1 && <HabitRecoveryFields {...sectionProps} />}
            {step === 2 && <HabitScheduleFields {...sectionProps} mode="create" />}

            {last && (
              <section className="wizard-recap" aria-labelledby="wizard-recap-title">
                <p id="wizard-recap-title" className="wizard-recap__title">
                  <Sparkles size={15} aria-hidden="true" /> Ready to <em>begin</em>
                </p>
                <HabitPreview state={state} today={today} />
              </section>
            )}
          </div>

          <div className="wizard-actions">
            <button
              type="submit"
              className="button button--primary button--block wizard-actions__primary"
              disabled={pending}
            >
              {last ? 'Create habit' : 'Next'}
              {last ? (
                <Sparkles size={18} aria-hidden="true" />
              ) : (
                <ArrowRight size={18} aria-hidden="true" />
              )}
            </button>
            {step === 1 && (
              <button
                type="button"
                className="link-button link-button--center"
                onClick={() => {
                  setStep(2);
                }}
              >
                Skip this step
              </button>
            )}
          </div>
        </form>

        <aside className="habit-wizard__preview" aria-label="Preview">
          <p className="habit-wizard__preview-title">
            Live <em>preview</em>
          </p>
          <HabitPreview state={state} today={today} />
        </aside>
      </div>
    </div>
  );
}
