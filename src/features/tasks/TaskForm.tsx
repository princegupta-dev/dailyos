import { useContext, useState, type SyntheticEvent, type ReactNode } from 'react';
import { SelectField, TextAreaField, TextField } from '@/components/form';
import { ToastContext } from '@/components/toast-context';
import { toAppError } from '@/db/errors';
import {
  PRIORITY_LABELS,
  TASK_PRIORITIES,
  type Task,
  type TaskDraft,
  type TaskPriority,
} from '@/domain/task';
import { issuesByField } from '@/lib/validation';

const PRIORITY_OPTIONS = TASK_PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }));

interface TaskFormProps {
  initial?: Task;
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => Promise<void>;
  onCancel?: () => void;
  /** Extra controls rendered above the actions (e.g. "Plan for today"). */
  children?: ReactNode;
}

export function TaskForm({ initial, submitLabel, onSubmit, onCancel, children }: TaskFormProps) {
  const notify = useContext(ToastContext);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [estimate, setEstimate] = useState(initial?.estimatedMinutes?.toString() ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await onSubmit({
        title,
        description,
        priority,
        dueDate: dueDate === '' ? undefined : dueDate,
        estimatedMinutes: estimate.trim() === '' ? undefined : Number(estimate),
      });
    } catch (error) {
      const appError = toAppError(error);
      if (appError.kind === 'validation') setErrors(issuesByField(appError.issues));
      else notify({ kind: 'error', message: appError.message });
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="form" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <TextField
        label="Title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
        }}
        error={errors.title}
        required
        maxLength={200}
        autoComplete="off"
      />
      <TextAreaField
        label="Notes"
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
        }}
        error={errors.description}
        hint="Optional"
      />
      <div className="form__row">
        <SelectField
          label="Priority"
          value={priority}
          options={PRIORITY_OPTIONS}
          onChange={(e) => {
            setPriority(e.target.value as TaskPriority);
          }}
        />
        <TextField
          label="Estimate (minutes)"
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          value={estimate}
          onChange={(e) => {
            setEstimate(e.target.value);
          }}
          error={errors.estimatedMinutes}
        />
      </div>
      <TextField
        label="Due date"
        type="date"
        value={dueDate}
        onChange={(e) => {
          setDueDate(e.target.value);
        }}
        error={errors.dueDate}
        hint="Optional"
      />
      {children}
      <div className="form__actions">
        {onCancel && (
          <button type="button" className="button button--secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="button button--primary" disabled={pending}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
