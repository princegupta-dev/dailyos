import { Compass, Target } from 'lucide-react';
import { useCallback, useState, type ReactNode, type SyntheticEvent } from 'react';
import { LiveView } from '@/components/LiveView';
import { Section } from '@/components/Section';
import { getPlan, updatePlanDetails, type PlanDetailsPatch } from '@/db/repositories/plans';
import { MAX_OUTCOMES, type DailyPlan } from '@/domain/plan';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';

interface DraftOutcome {
  id?: string | undefined;
  text: string;
  done: boolean;
}

function outcomesFrom(plan: DailyPlan | undefined): DraftOutcome[] {
  const outcomes: DraftOutcome[] = (plan?.topOutcomes ?? []).map((o) => ({ ...o }));
  while (outcomes.length < MAX_OUTCOMES) outcomes.push({ text: '', done: false });
  return outcomes;
}

/** Loads `date`'s plan and hands it to a form, keyed by date so drafts never carry over. */
function WithPlan({
  date,
  children,
}: {
  date: string;
  children: (plan: DailyPlan | undefined) => ReactNode;
}) {
  const plan = useLiveData(useCallback(() => getPlan(date), [date]));
  return <LiveView state={plan}>{(data) => children(data)}</LiveView>;
}

/**
 * A draft of one part of the plan. `draft` is null until the person edits; while null, the
 * saved value is shown, so changes from other tabs appear live. Once editing starts, they
 * can't overwrite unsaved text.
 */
function useDraft<T>(
  saved: T,
  date: string,
  toPatch: (value: T) => PlanDetailsPatch,
  toast: string,
) {
  const { run, pending } = useAction();
  const [draft, setDraft] = useState<T | null>(null);
  const shown = draft ?? saved;

  const edit = (change: (current: T) => T) => {
    setDraft((current) => change(current ?? saved));
  };

  const save = async (event?: SyntheticEvent) => {
    event?.preventDefault();
    const result = await run(() => updatePlanDetails(date, toPatch(shown)), toast);
    if (result.ok) setDraft(null);
  };

  const discard = () => {
    setDraft(null);
  };

  return { shown, dirty: draft !== null, edit, save, discard, run, pending };
}

function DraftActions({
  pending,
  label,
  onDiscard,
}: {
  pending: boolean;
  label: string;
  onDiscard: () => void;
}) {
  return (
    <div className="form__actions section__action">
      <button
        type="button"
        className="button button--secondary button--compact"
        onClick={onDiscard}
      >
        Discard
      </button>
      <button type="submit" className="button button--primary button--compact" disabled={pending}>
        {label}
      </button>
    </div>
  );
}

/** One line that sets the tone for `date`. */
export function DailyIntention({ date }: { date: string }) {
  return (
    <WithPlan date={date}>
      {(plan) => <IntentionForm key={date} date={date} plan={plan} />}
    </WithPlan>
  );
}

function IntentionForm({ date, plan }: { date: string; plan: DailyPlan | undefined }) {
  const { shown, dirty, edit, save, discard, pending } = useDraft(
    plan?.intention ?? '',
    date,
    (intention) => ({ intention }),
    'Intention saved',
  );

  return (
    <form onSubmit={(e) => void save(e)}>
      <Section title="Intention" icon={Compass} className="section--intention">
        <label className="visually-hidden" htmlFor="daily-intention">
          Today’s intention
        </label>
        <textarea
          id="daily-intention"
          className="input intention-input"
          rows={2}
          maxLength={500}
          placeholder="One line to set the tone for today…"
          value={shown}
          onChange={(e) => {
            const intention = e.target.value;
            edit(() => intention);
          }}
        />
        {dirty && <DraftActions pending={pending} label="Save intention" onDiscard={discard} />}
      </Section>
    </form>
  );
}

/** Up to three things that would make `date` count, each ticked off in place. */
export function DailyPriorities({ date }: { date: string }) {
  return (
    <WithPlan date={date}>
      {(plan) => <PrioritiesForm key={date} date={date} plan={plan} />}
    </WithPlan>
  );
}

function PrioritiesForm({ date, plan }: { date: string; plan: DailyPlan | undefined }) {
  const { shown, dirty, edit, save, discard, run, pending } = useDraft(
    outcomesFrom(plan),
    date,
    (topOutcomes) => ({ topOutcomes }),
    'Priorities saved',
  );

  const toggle = (index: number) => {
    const outcome = shown[index];
    if (!outcome) return;
    const flipped = shown.map((o, i) => (i === index ? { ...o, done: !o.done } : o));
    if (!dirty && outcome.id !== undefined) {
      // Saved priority and no pending edits: ticking it off saves immediately.
      void run(() => updatePlanDetails(date, { topOutcomes: flipped }));
      return;
    }
    edit(() => flipped);
  };

  const doneCount = (plan?.topOutcomes ?? []).filter((o) => o.done).length;
  const savedCount = plan?.topOutcomes.length ?? 0;

  return (
    <form onSubmit={(e) => void save(e)}>
      <Section
        title="Priorities"
        icon={Target}
        className="section--priorities"
        meta={savedCount > 0 ? `${doneCount} of ${savedCount} done` : undefined}
      >
        <ol className="outcome-list">
          {shown.map((outcome, index) => (
            <li
              key={outcome.id ?? `new-${index}`}
              className={`outcome-list__item outcome-list__item--editable${outcome.done ? ' outcome-list__item--done' : ''}`}
            >
              <input
                type="checkbox"
                className="checkbox"
                checked={outcome.done}
                disabled={outcome.text.trim() === '' || pending}
                aria-label={`Priority ${index + 1} done`}
                onChange={() => {
                  toggle(index);
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
                  edit((d) => d.map((o, i) => (i === index ? { ...o, text } : o)));
                }}
              />
            </li>
          ))}
        </ol>
        {dirty && <DraftActions pending={pending} label="Save priorities" onDiscard={discard} />}
      </Section>
    </form>
  );
}
