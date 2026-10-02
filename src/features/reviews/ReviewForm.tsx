import { Plus, X } from 'lucide-react';
import { useContext, useId, useState, type SyntheticEvent } from 'react';
import { TextAreaField } from '@/components/form';
import { ToastContext } from '@/components/toast-context';
import { toAppError } from '@/db/errors';
import { saveReview, type ReviewWithActions } from '@/db/repositories/reviews';
import { NEXT_PERIOD_NAME, type Period, type ReviewActionStatus } from '@/domain/review';
import { issuesByField } from '@/lib/validation';

interface DraftAction {
  key: string;
  id?: string | undefined;
  title: string;
  status: ReviewActionStatus;
  targetDate: string;
}

const PROMPTS = {
  daily: {
    wins: 'What went well today?',
    blockers: 'What got in the way?',
    lessons: 'What did you learn about how you work?',
    improvements: 'What would you do differently?',
  },
  weekly: {
    wins: 'Wins this week',
    blockers: 'Recurring blockers',
    lessons: 'Lessons',
    improvements: 'What to change next week',
  },
  monthly: {
    wins: 'Highlights of the month',
    blockers: 'What held you back',
    lessons: 'What you learned',
    improvements: 'What to change next month',
  },
} as const;

let keySeed = 0;
const nextKey = () => `new-${keySeed++}`;

export function ReviewForm({ period, existing }: { period: Period; existing: ReviewWithActions }) {
  const notify = useContext(ToastContext);
  const ratingName = useId();
  const review = existing.review;
  const [rating, setRating] = useState<number | undefined>(review?.rating);
  const [wins, setWins] = useState(review?.wins ?? '');
  const [blockers, setBlockers] = useState(review?.blockers ?? '');
  const [lessons, setLessons] = useState(review?.lessons ?? '');
  const [improvements, setImprovements] = useState(review?.improvements ?? '');
  const [focus, setFocus] = useState(review?.focus ?? '');
  const [actions, setActions] = useState<DraftAction[]>(() =>
    existing.actions.map((a) => ({
      key: a.id,
      id: a.id,
      title: a.title,
      status: a.status,
      targetDate: a.targetDate ?? '',
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const prompts = PROMPTS[period.type];

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await saveReview(period, {
        wins,
        blockers,
        lessons,
        improvements,
        focus,
        rating,
        actions: actions.map((a) => ({
          id: a.id,
          title: a.title,
          status: a.status,
          targetDate: a.targetDate === '' ? undefined : a.targetDate,
        })),
      });
      notify({ kind: 'success', message: 'Review saved' });
    } catch (error) {
      const appError = toAppError(error);
      if (appError.kind === 'validation') setErrors(issuesByField(appError.issues));
      else notify({ kind: 'error', message: appError.message });
    } finally {
      setPending(false);
    }
  };

  const updateAction = (key: string, change: Partial<DraftAction>) => {
    setActions((list) => list.map((a) => (a.key === key ? { ...a, ...change } : a)));
  };

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <fieldset className="fieldset">
        <legend className="field__label">How did it go?</legend>
        <div className="rating" role="radiogroup" aria-label="Rating from 1 to 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="rating__option">
              <input
                type="radio"
                name={ratingName}
                value={value}
                checked={rating === value}
                onChange={() => {
                  setRating(value);
                }}
              />
              <span>{value}</span>
            </label>
          ))}
        </div>
        <div className="rating__legend muted small">
          <span>Rough</span>
          {rating !== undefined && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setRating(undefined);
              }}
            >
              Clear rating
            </button>
          )}
          <span>Great</span>
        </div>
      </fieldset>

      <TextAreaField
        label={prompts.wins}
        value={wins}
        onChange={(e) => {
          setWins(e.target.value);
        }}
        error={errors.wins}
      />
      <TextAreaField
        label={prompts.blockers}
        hint="One per line helps spot repeats in weekly reviews"
        value={blockers}
        onChange={(e) => {
          setBlockers(e.target.value);
        }}
        error={errors.blockers}
      />
      <TextAreaField
        label={prompts.lessons}
        value={lessons}
        onChange={(e) => {
          setLessons(e.target.value);
        }}
        error={errors.lessons}
      />
      <TextAreaField
        label={prompts.improvements}
        value={improvements}
        onChange={(e) => {
          setImprovements(e.target.value);
        }}
        error={errors.improvements}
      />
      <TextAreaField
        label={`Focus for ${NEXT_PERIOD_NAME[period.type]}`}
        rows={2}
        value={focus}
        maxLength={1000}
        onChange={(e) => {
          setFocus(e.target.value);
        }}
        error={errors.focus}
      />

      <fieldset className="fieldset">
        <legend className="field__label">Next actions</legend>
        {actions.length === 0 && (
          <p className="field__hint">Concrete next steps. Open ones carry forward until done.</p>
        )}
        <ul className="action-editor">
          {actions.map((action, index) => (
            <li key={action.key} className="action-editor__row">
              <input
                type="checkbox"
                className="checkbox"
                aria-label={`Action ${index + 1} done`}
                checked={action.status === 'done'}
                onChange={(e) => {
                  updateAction(action.key, { status: e.target.checked ? 'done' : 'open' });
                }}
              />
              <input
                className="input"
                aria-label={`Action ${index + 1}`}
                placeholder="Next action"
                maxLength={200}
                value={action.title}
                onChange={(e) => {
                  updateAction(action.key, { title: e.target.value });
                }}
              />
              <input
                type="date"
                className="input action-editor__date"
                aria-label={`Action ${index + 1} target date`}
                value={action.targetDate}
                onChange={(e) => {
                  updateAction(action.key, { targetDate: e.target.value });
                }}
              />
              <button
                type="button"
                className="icon-button icon-button--plain"
                aria-label={`Remove action ${index + 1}`}
                onClick={() => {
                  setActions((list) => list.filter((a) => a.key !== action.key));
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setActions((list) => [
              ...list,
              { key: nextKey(), title: '', status: 'open', targetDate: '' },
            ]);
          }}
        >
          <Plus size={16} aria-hidden="true" /> Add action
        </button>
        {errors.actions && <p className="field__error">{errors.actions}</p>}
      </fieldset>

      <div className="form__actions">
        <button type="submit" className="button button--primary" disabled={pending}>
          {review ? 'Save changes' : 'Save review'}
        </button>
      </div>
    </form>
  );
}
