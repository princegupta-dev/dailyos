import {
  CloudRain,
  Compass,
  Lightbulb,
  ListTodo,
  Plus,
  Repeat2,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useContext, useState, type SyntheticEvent } from 'react';
import { TextAreaField } from '@/components/form';
import { ToastContext } from '@/components/toast-context';
import { toAppError } from '@/db/errors';
import { saveReview, type ReviewWithActions } from '@/db/repositories/reviews';
import { NEXT_PERIOD_NAME, type Period, type ReviewActionStatus } from '@/domain/review';
import { issuesByField } from '@/lib/validation';
import { RatingField } from './RatingField';

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

/** An icon and tone for each prompt, so the questions read as distinct moments. */
function Prompt({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone: 'well' | 'way' | 'learn' | 'change';
  children: ReactNode;
}) {
  return (
    <div className={`reflect-prompt reflect-prompt--${tone}`}>
      <span className="reflect-prompt__icon" aria-hidden="true">
        <Icon size={15} />
      </span>
      {children}
    </div>
  );
}

let keySeed = 0;
const nextKey = () => `new-${keySeed++}`;

export function ReviewForm({ period, existing }: { period: Period; existing: ReviewWithActions }) {
  const notify = useContext(ToastContext);
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
  // A day is rated and reflected on per habit and task (see ItemReflections), so the daily
  // form only plans ahead. Answers saved before that still show, so they can be read or cleared.
  const daily = period.type === 'daily';
  const show = (saved: string | number | undefined) =>
    !daily || (saved !== undefined && saved !== '');

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
    <form className="form review-form" onSubmit={(e) => void submit(e)} noValidate>
      {show(review?.rating) && (
        <RatingField
          legend={daily ? 'Day rating (earlier reviews)' : 'How did it go?'}
          groupLabel="Rating from 1 to 5"
          value={rating}
          onChange={setRating}
        />
      )}

      {show(review?.wins) && (
        <Prompt icon={Trophy} tone="well">
          <TextAreaField
            label={prompts.wins}
            value={wins}
            onChange={(e) => {
              setWins(e.target.value);
            }}
            error={errors.wins}
          />
        </Prompt>
      )}
      {show(review?.blockers) && (
        <Prompt icon={CloudRain} tone="way">
          <TextAreaField
            label={prompts.blockers}
            hint="One per line helps spot repeats in weekly reviews"
            value={blockers}
            onChange={(e) => {
              setBlockers(e.target.value);
            }}
            error={errors.blockers}
          />
        </Prompt>
      )}
      {show(review?.lessons) && (
        <Prompt icon={Lightbulb} tone="learn">
          <TextAreaField
            label={prompts.lessons}
            value={lessons}
            onChange={(e) => {
              setLessons(e.target.value);
            }}
            error={errors.lessons}
          />
        </Prompt>
      )}
      {show(review?.improvements) && (
        <Prompt icon={Repeat2} tone="change">
          <TextAreaField
            label={prompts.improvements}
            value={improvements}
            onChange={(e) => {
              setImprovements(e.target.value);
            }}
            error={errors.improvements}
          />
        </Prompt>
      )}
      <div className="focus-field">
        <span className="focus-field__icon" aria-hidden="true">
          <Compass size={18} />
        </span>
        <TextAreaField
          label={`Focus for ${NEXT_PERIOD_NAME[period.type]}`}
          hint="One line you’ll see first thing."
          rows={2}
          value={focus}
          maxLength={1000}
          placeholder="The one thing that matters most…"
          onChange={(e) => {
            setFocus(e.target.value);
          }}
          error={errors.focus}
        />
      </div>

      <fieldset className="fieldset next-actions">
        <legend className="field__label next-actions__legend">
          <ListTodo size={16} aria-hidden="true" /> Next actions
          {actions.length > 0 && (
            <span className="next-actions__count">
              {actions.filter((a) => a.status === 'done').length}/{actions.length}
            </span>
          )}
        </legend>
        {actions.length === 0 && (
          <p className="field__hint">Concrete next steps. Open ones carry forward until done.</p>
        )}
        <ul className="action-editor">
          {actions.map((action, index) => (
            <li
              key={action.key}
              className={`action-editor__row${action.status === 'done' ? ' action-editor__row--done' : ''}`}
            >
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
          className="add-action"
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

      <div className="form__actions review-form__actions">
        <button
          type="submit"
          className="button button--primary review-form__save"
          disabled={pending}
        >
          {review ? 'Save changes' : daily ? 'Save plan' : 'Save review'}
        </button>
      </div>
    </form>
  );
}
