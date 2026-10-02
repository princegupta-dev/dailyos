import { ArrowLeft } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { createHabit } from '@/db/repositories/habits';
import { useAction } from '@/hooks/useAction';
import { HabitBasicsFields, HabitRecoveryFields, HabitScheduleFields } from './HabitForm';
import {
  initialHabitForm,
  STEP_FIELDS,
  useHabitFormSubmit,
  type HabitFormState,
} from './habitFormState';

const STEPS = ['Details', 'Flexibility', 'Schedule'] as const;

/** Three short steps; only the name is required. Everything else has sensible defaults. */
export function NewHabitPage() {
  const navigate = useNavigate();
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

  const sectionProps = { state, errors, update };
  return (
    <>
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
      <ol className="stepper" aria-label="Steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`stepper__step${index === step ? ' stepper__step--current' : ''}${index < step ? ' stepper__step--done' : ''}`}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className="stepper__number">{index + 1}</span>
            <span className="stepper__label">{label}</span>
          </li>
        ))}
      </ol>
      <form className="form" onSubmit={(e) => void next(e)} noValidate>
        <h2 className="step-title">{STEPS[step]}</h2>
        {step === 0 && <HabitBasicsFields {...sectionProps} />}
        {step === 1 && <HabitRecoveryFields {...sectionProps} />}
        {step === 2 && <HabitScheduleFields {...sectionProps} />}
        <button type="submit" className="button button--primary button--block" disabled={pending}>
          {step < STEPS.length - 1 ? 'Next' : 'Create habit'}
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
      </form>
    </>
  );
}
