import { Moon } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router';
import { Section } from '@/components/Section';
import { getReviewForPeriod, listOpenActions } from '@/db/repositories/reviews';
import { useLiveData } from '@/hooks/useLiveData';
import { plural } from './format';
import { OpenActionsList } from './OpenActionsList';

const MAX_SHOWN = 3;
const listAllOpenActions = () => listOpenActions();

export function EveningReview({ today }: { today: string }) {
  const review = useLiveData(useCallback(() => getReviewForPeriod('daily', today), [today]));
  const open = useLiveData(listAllOpenActions);
  const reviewed = review.status === 'ready' && review.data.review !== undefined;
  const actions = open.status === 'ready' ? open.data : [];

  return (
    <Section
      title="Evening review"
      meta={actions.length > 0 ? plural(actions.length, 'open action') : undefined}
    >
      <p className="muted small">
        {reviewed
          ? 'You’ve reviewed today. You can revisit it anytime.'
          : 'Compare your plan with what happened and set tomorrow’s focus.'}
      </p>
      <Link
        to={`/review/daily/${today}`}
        className="button button--secondary button--block section__action"
      >
        <Moon size={18} aria-hidden="true" />
        {reviewed ? 'Open today’s review' : 'Start evening review'}
      </Link>
      {actions.length > 0 && (
        <div className="subsection">
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
