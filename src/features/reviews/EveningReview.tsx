import { ArrowRight, Check, Moon } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router';
import { Section } from '@/components/Section';
import { listReflectionsForDate } from '@/db/repositories/reflections';
import { listOpenActions, reviewedPeriods } from '@/db/repositories/reviews';
import { useDayPart } from '@/hooks/useDayPart';
import { useLiveData } from '@/hooks/useLiveData';
import { useTimeZone } from '@/hooks/useToday';
import { plural } from './format';
import { OpenActionsList } from './OpenActionsList';

const MAX_SHOWN = 3;
const listAllOpenActions = () => listOpenActions();

/** The questions the daily review asks about each habit and task. */
const PROMPTS = ['Rate each habit and task', 'What went well?', 'What got in the way?'];

export function EveningReview({ today }: { today: string }) {
  const done = useLiveData(
    useCallback(() => reviewedPeriods([{ type: 'daily', start: today, end: today }]), [today]),
  );
  const reflections = useLiveData(useCallback(() => listReflectionsForDate(today), [today]));
  const open = useLiveData(listAllOpenActions);
  // Reviewed once the day has a saved review or any habit or task reflection.
  const reviewed = done.status === 'ready' && done.data.has(`daily:${today}`);
  const reflected = reflections.status === 'ready' ? reflections.data.length : 0;
  const actions = open.status === 'ready' ? open.data : [];
  const part = useDayPart(useTimeZone());
  // In the evening, an unreviewed day gently comes forward.
  const timely = !reviewed && (part === 'evening' || part === 'night');

  return (
    <Section
      title="Evening review"
      icon={Moon}
      className={`section--dusk${timely ? ' section--dusk-timely' : ''}`}
      meta={actions.length > 0 ? plural(actions.length, 'open action') : undefined}
    >
      <div className="evening-card">
        {timely && (
          <p className="evening-card__timely">
            <span className="evening-card__pulse" aria-hidden="true" />
            Now’s a good moment to look back
          </p>
        )}
        <p className="evening-card__prompt">
          {reviewed ? (
            <>
              Today is <em>reflected on</em>.
            </>
          ) : (
            <>
              How did today <em>really</em> go?
            </>
          )}
        </p>
        <p className="evening-card__copy">
          {reviewed
            ? 'You’ve reviewed today. You can revisit it anytime.'
            : 'Reflect on each habit and task, then set tomorrow’s focus.'}
        </p>
        {reviewed ? (
          reflected > 0 && (
            <p className="evening-card__done">
              <Check size={14} strokeWidth={2.5} aria-hidden="true" />
              {plural(reflected, 'reflection')} saved
            </p>
          )
        ) : (
          <ul className="evening-card__prompts" aria-label="You’ll be asked">
            {PROMPTS.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
        )}
        <Link to={`/review/daily/${today}`} className="button button--light evening-card__cta">
          <Moon size={18} aria-hidden="true" />
          {reviewed ? 'Open today’s review' : 'Start evening review'}
          <ArrowRight className="evening-card__arrow" size={16} aria-hidden="true" />
        </Link>
      </div>
      {actions.length > 0 && (
        <div className="subsection evening-actions">
          <h3 className="subsection__title">Open actions</h3>
          <OpenActionsList items={actions.slice(0, MAX_SHOWN)} today={today} />
          {actions.length > MAX_SHOWN && (
            <Link to="/review" className="link-button">
              See all {actions.length}
            </Link>
          )}
        </div>
      )}
    </Section>
  );
}
