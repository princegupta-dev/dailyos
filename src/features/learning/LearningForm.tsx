import { CalendarPlus, X } from 'lucide-react';
import { useContext, useId, useState, type SyntheticEvent } from 'react';
import { TextAreaField, TextField } from '@/components/form';
import { ToastContext } from '@/components/toast-context';
import { toAppError } from '@/db/errors';
import { listOpenTasks } from '@/db/repositories/tasks';
import {
  STRUCTURED_FIELDS,
  STRUCTURED_LABELS,
  suggestReviewDates,
  type LearningDraft,
  type LearningEntry,
  type StructuredField,
} from '@/domain/learning';
import type { Task } from '@/domain/task';
import { useLiveData } from '@/hooks/useLiveData';
import { relativeDayLabel } from '@/lib/format';
import { issuesByField } from '@/lib/validation';

interface LearningFormProps {
  initial?: LearningEntry;
  initialRelatedTasks?: Task[];
  topics: readonly string[];
  today: string;
  submitLabel: string;
  onSubmit: (draft: LearningDraft) => Promise<void>;
  onCancel: () => void;
}

type StructuredValues = Record<StructuredField, string>;

export function LearningForm({
  initial,
  initialRelatedTasks = [],
  topics,
  today,
  submitLabel,
  onSubmit,
  onCancel,
}: LearningFormProps) {
  const notify = useContext(ToastContext);
  const topicListId = useId();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [structured, setStructured] = useState<StructuredValues>(
    () =>
      Object.fromEntries(STRUCTURED_FIELDS.map((f) => [f, initial?.[f] ?? ''])) as StructuredValues,
  );
  const [related, setRelated] = useState<Task[]>(initialRelatedTasks);
  const [reviewDates, setReviewDates] = useState<string[]>(
    initial?.reviewDates.map((r) => r.date) ?? [],
  );
  const [newReviewDate, setNewReviewDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const openTasks = useLiveData(listOpenTasks);

  const hasStructured = STRUCTURED_FIELDS.some((f) => initial?.[f] !== undefined);
  const addReviewDates = (dates: string[]) => {
    setReviewDates((current) => [...new Set([...current, ...dates])].sort());
  };

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await onSubmit({
        title,
        content,
        topic,
        ...structured,
        relatedTaskIds: related.map((t) => t.id),
        reviewDates,
      });
    } catch (error) {
      const appError = toAppError(error);
      if (appError.kind === 'validation') setErrors(issuesByField(appError.issues));
      else notify({ kind: 'error', message: appError.message });
    } finally {
      setPending(false);
    }
  };

  const candidates =
    openTasks.status === 'ready'
      ? openTasks.data.filter((t) => !related.some((r) => r.id === t.id))
      : [];

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <TextAreaField
        label="What did you learn?"
        rows={5}
        value={content}
        error={errors.content}
        onChange={(e) => {
          setContent(e.target.value);
        }}
      />
      <TextField
        label="Title"
        hint="Optional. The first line is used if you leave it blank."
        value={title}
        maxLength={200}
        autoComplete="off"
        error={errors.title}
        onChange={(e) => {
          setTitle(e.target.value);
        }}
      />
      <TextField
        label="Topic"
        hint="Optional, e.g. TypeScript or Leadership"
        value={topic}
        maxLength={60}
        list={topicListId}
        autoComplete="off"
        error={errors.topic}
        onChange={(e) => {
          setTopic(e.target.value);
        }}
      />
      <datalist id={topicListId}>
        {topics.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <details className="disclosure" open={hasStructured}>
        <summary className="disclosure__summary">Add detail</summary>
        <div className="form disclosure__body">
          {STRUCTURED_FIELDS.map((field) =>
            field === 'source' ? (
              <TextField
                key={field}
                label={STRUCTURED_LABELS[field]}
                hint="A link, book, person, or course"
                value={structured[field]}
                maxLength={500}
                onChange={(e) => {
                  setStructured((s) => ({ ...s, [field]: e.target.value }));
                }}
              />
            ) : (
              <TextAreaField
                key={field}
                label={STRUCTURED_LABELS[field]}
                rows={3}
                value={structured[field]}
                onChange={(e) => {
                  setStructured((s) => ({ ...s, [field]: e.target.value }));
                }}
              />
            ),
          )}
        </div>
      </details>

      <fieldset className="fieldset">
        <legend className="field__label">Related tasks</legend>
        {related.length > 0 && (
          <ul className="chip-list">
            {related.map((task) => (
              <li key={task.id} className="removable-chip">
                {task.title}
                <button
                  type="button"
                  aria-label={`Remove “${task.title}”`}
                  onClick={() => {
                    setRelated((r) => r.filter((t) => t.id !== task.id));
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {candidates.length > 0 ? (
          <select
            className="input input--select"
            aria-label="Link an open task"
            value=""
            onChange={(e) => {
              const task = candidates.find((t) => t.id === e.target.value);
              if (task) setRelated((r) => [...r, task]);
            }}
          >
            <option value="">Link an open task…</option>
            {candidates.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        ) : (
          related.length === 0 && <p className="field__hint">No open tasks to link.</p>
        )}
        {errors.relatedTaskIds && <p className="field__error">{errors.relatedTaskIds}</p>}
      </fieldset>

      <fieldset className="fieldset">
        <legend className="field__label">Review dates</legend>
        {reviewDates.length > 0 && (
          <ul className="chip-list">
            {reviewDates.map((date) => (
              <li key={date} className="removable-chip">
                {relativeDayLabel(date, today)}
                <button
                  type="button"
                  aria-label={`Remove review on ${relativeDayLabel(date, today)}`}
                  onClick={() => {
                    setReviewDates((d) => d.filter((x) => x !== date));
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="inline-form">
          <label className="visually-hidden" htmlFor={`${topicListId}-review`}>
            Add review date
          </label>
          <input
            id={`${topicListId}-review`}
            type="date"
            className="input"
            value={newReviewDate}
            onChange={(e) => {
              setNewReviewDate(e.target.value);
            }}
          />
          <button
            type="button"
            className="button button--secondary button--compact"
            disabled={newReviewDate === ''}
            onClick={() => {
              addReviewDates([newReviewDate]);
              setNewReviewDate('');
            }}
          >
            Add
          </button>
        </div>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            addReviewDates(suggestReviewDates(initial?.capturedDate ?? today));
          }}
        >
          <CalendarPlus size={16} aria-hidden="true" /> Suggest: 1 day, 1 week, 1 month
        </button>
        {errors.reviewDates && <p className="field__error">{errors.reviewDates}</p>}
      </fieldset>

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
