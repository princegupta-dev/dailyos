import { Compass, Quote, Target } from 'lucide-react';
import { useCallback, useState, type SyntheticEvent } from 'react';
import { LiveView } from '@/components/LiveView';
import { Section } from '@/components/Section';
import { getPlan, updatePlanDetails } from '@/db/repositories/plans';
import { MAX_OUTCOMES, type DailyPlan } from '@/domain/plan';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';

interface DraftOutcome {
  id?: string | undefined;
  text: string;
  done: boolean;
}

interface Draft {
  intention: string;
  outcomes: DraftOutcome[];
}

function draftFrom(plan: DailyPlan | undefined): Draft {
  const outcomes: DraftOutcome[] = (plan?.topOutcomes ?? []).map((o) => ({ ...o }));
  while (outcomes.length < MAX_OUTCOMES) outcomes.push({ text: '', done: false });
  return { intention: plan?.intention ?? '', outcomes };
}

/** Intention and top outcomes for `date`. */
export function DailyIntention({ date }: { date: string }) {
  const plan = useLiveData(useCallback(() => getPlan(date), [date]));
  return (
    <LiveView state={plan}>
      {(data) => <IntentionForm key={date} date={date} plan={data} />}
    </LiveView>
  );
}

function IntentionForm({ date, plan }: { date: string; plan: DailyPlan | undefined }) {
  const { run, pending } = useAction();
  // `draft` is null until the person edits. While null, the saved plan is shown, so changes
  // from other tabs appear live; once editing starts, they can't overwrite unsaved text.
  const [draft, setDraft] = useState<Draft | null>(null);
  const shown = draft ?? draftFrom(plan);

  const edit = (change: (current: Draft) => Draft) => {
    setDraft((current) => change(current ?? draftFrom(plan)));
  };

  const save = async (event?: SyntheticEvent) => {
    event?.preventDefault();
    const result = await run(
      () => updatePlanDetails(date, { intention: shown.intention, topOutcomes: shown.outcomes }),
      'Plan saved',
    );
    if (result.ok) setDraft(null);
  };

  const toggleOutcome = (index: number) => {
    const outcome = shown.outcomes[index];
    if (!outcome) return;
    if (draft === null && outcome.id !== undefined) {
      // Saved outcome and no pending edits: ticking it off saves immediately.
      const outcomes = shown.outcomes.map((o, i) => (i === index ? { ...o, done: !o.done } : o));
      void run(() => updatePlanDetails(date, { topOutcomes: outcomes }));
      return;
    }
    edit((d) => ({
      ...d,
      outcomes: d.outcomes.map((o, i) => (i === index ? { ...o, done: !o.done } : o)),
    }));
  };

  const doneCount = (plan?.topOutcomes ?? []).filter((o) => o.done).length;
  const savedCount = plan?.topOutcomes.length ?? 0;

  return (
    <form onSubmit={(e) => void save(e)}>
      <Section
        title="Intention"
        icon={Compass}
        description="What matters most today?"
        className="section--focus"
      >
        <div className="intention-card">
          <Quote className="intention-card__mark" size={28} aria-hidden="true" />
          <label className="visually-hidden" htmlFor="daily-intention">
            Today’s intention
          </label>
          <textarea
            id="daily-intention"
            className="intention-input"
            rows={2}
            maxLength={500}
            placeholder="Write one line that sets the tone for today…"
            value={shown.intention}
            onChange={(e) => {
              const intention = e.target.value;
              edit((d) => ({ ...d, intention }));
            }}
          />
          <p className="intention-card__hint" aria-hidden="true">
            {shown.intention.trim() === '' ? 'Optional · just for you' : 'Your focus for today'}
          </p>
        </div>
      </Section>

      <Section
        title="Priorities"
        icon={Target}
        description="Up to three things that would make today count"
        meta={savedCount > 0 ? `${doneCount} of ${savedCount} done` : undefined}
      >
        <ol className="outcome-list">
          {shown.outcomes.map((outcome, index) => (
            <li
              key={outcome.id ?? `new-${index}`}
              className={`outcome-list__item outcome-list__item--editable${outcome.done ? ' outcome-list__item--done' : ''}${index === 0 ? ' outcome-list__item--top' : ''}`}
            >
              <span className="outcome-list__rank" aria-hidden="true">
                {index + 1}
              </span>
              <input
                type="checkbox"
                className="checkbox"
                checked={outcome.done}
                disabled={outcome.text.trim() === '' || pending}
                aria-label={`Priority ${index + 1} done`}
                onChange={() => {
                  toggleOutcome(index);
                }}
              />
              <label className="visually-hidden" htmlFor={`outcome-${index}`}>
                Priority {index + 1}
              </label>
              <input
                id={`outcome-${index}`}
                className={`outcome-input${outcome.done ? ' outcome-input--done' : ''}`}
                maxLength={200}
                placeholder={index === 0 ? 'Most important thing today' : `Priority ${index + 1}`}
                autoComplete="off"
                value={outcome.text}
                onChange={(e) => {
                  const text = e.target.value;
                  edit((d) => ({
                    ...d,
                    outcomes: d.outcomes.map((o, i) => (i === index ? { ...o, text } : o)),
                  }));
                }}
              />
            </li>
          ))}
        </ol>
        {draft !== null && (
          <div className="form__actions section__action">
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={() => {
                setDraft(null);
              }}
            >
              Discard
            </button>
            <button
              type="submit"
              className="button button--primary button--compact"
              disabled={pending}
            >
              Save plan
            </button>
          </div>
        )}
      </Section>
    </form>
  );
}
