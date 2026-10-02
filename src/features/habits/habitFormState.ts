import { useContext, useState } from 'react';
import { ToastContext } from '@/components/toast-context';
import { toAppError } from '@/db/errors';
import type { HabitCategory } from '@/domain/categories';
import { isWeekdaysSchedule, WEEKDAYS_MON_FRI, type Habit, type HabitDraft } from '@/domain/habit';
import { issuesByField } from '@/lib/validation';

/** Schedule choices shown to people; "weekdays" is stored as selected days Mon–Fri. */
export type ScheduleChoice = 'daily' | 'weekdays' | 'selected_days' | 'weekly';

export interface HabitFormState {
  name: string;
  description: string;
  category: HabitCategory;
  schedule: ScheduleChoice;
  weekdays: number[];
  target: string;
  unit: string;
  minimumTarget: string;
  allowAlternatives: boolean;
  alternatives: string[];
}

export function initialHabitForm(habit?: Habit): HabitFormState {
  let schedule: ScheduleChoice = habit?.frequency ?? 'daily';
  if (habit && isWeekdaysSchedule(habit)) schedule = 'weekdays';
  return {
    name: habit?.name ?? '',
    description: habit?.description ?? '',
    category: habit?.category ?? 'other',
    schedule,
    weekdays: habit?.weekdays ?? [...WEEKDAYS_MON_FRI],
    target: habit?.target?.toString() ?? '',
    unit: habit?.unit ?? '',
    minimumTarget: habit?.minimumTarget ?? '',
    allowAlternatives: (habit?.alternatives?.length ?? 0) > 0,
    alternatives: habit?.alternatives ?? [],
  };
}

export function toHabitDraft(state: HabitFormState): HabitDraft {
  const frequency = state.schedule === 'weekdays' ? 'selected_days' : state.schedule;
  return {
    name: state.name,
    description: state.description,
    category: state.category,
    frequency,
    weekdays: state.schedule === 'weekdays' ? [...WEEKDAYS_MON_FRI] : state.weekdays,
    target: state.target.trim() === '' ? undefined : Number(state.target),
    unit: state.unit,
    minimumTarget: state.minimumTarget,
    alternatives: state.allowAlternatives ? state.alternatives : [],
  };
}

/** Field paths that belong to each creation step, to jump back to a step with errors. */
export const STEP_FIELDS: readonly (readonly string[])[] = [
  ['name', 'description', 'category'],
  ['minimumTarget', 'alternatives'],
  ['frequency', 'weekdays', 'target', 'unit'],
];

/** Shared submit handling: maps validation issues to fields, other errors to a toast. */
export function useHabitFormSubmit(onSubmit: (draft: HabitDraft) => Promise<void>) {
  const notify = useContext(ToastContext);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const submit = async (state: HabitFormState): Promise<Record<string, string>> => {
    setPending(true);
    setErrors({});
    try {
      await onSubmit(toHabitDraft(state));
      return {};
    } catch (error) {
      const appError = toAppError(error);
      if (appError.kind === 'validation') {
        const fieldErrors = issuesByField(appError.issues);
        setErrors(fieldErrors);
        return fieldErrors;
      }
      notify({ kind: 'error', message: appError.message });
      return {};
    } finally {
      setPending(false);
    }
  };
  return { errors, setErrors, pending, submit };
}
