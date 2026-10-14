import { CalendarClock, CircleCheck, Circle, Compass, History, Target } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router';
import { LiveView } from '@/components/LiveView';
import { Section } from '@/components/Section';
import { listPastFocus } from '@/db/repositories/plans';
import { getReviewForPeriod } from '@/db/repositories/reviews';
import { NEXT_PERIOD_NAME, PERIOD_TYPES, periodContaining } from '@/domain/review';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { reviewPath } from '../reviews/format';
import { SettingsCard, SettingsRow } from '../settings/SettingsRow';
import { SubpageHero } from '../settings/SubpageHero';
import { DailyIntention, DailyPriorities } from './DailyIntention';

const PAST_DAYS = 14;

/** Focus set in the current day's, week's, and month's reviews, for the period after each. */
async function loadNextFocus(today: string, weekStartsOn: 0 | 1) {
  const found = await Promise.all(
    PERIOD_TYPES.map(async (type) => {
      const period = periodContaining(type, today, weekStartsOn);
      const { review } = await getReviewForPeriod(type, period.start);
      return { period, focus: review?.focus.trim() ?? '' };
    }),
  );
  return found.filter((f) => f.focus !== '');
}

/**
 * Intentions and priorities in one place: today's (editable, the same ones as on the
 * Dashboard), the focus your reviews set for what comes next, and the days before.
 */
export function FocusPage() {
  const today = useToday();
  const weekStartsOn = useWeekStartsOn();
  const next = useLiveData(
    useCallback(() => loadNextFocus(today, weekStartsOn), [today, weekStartsOn]),
  );
  const past = useLiveData(useCallback(() => listPastFocus(today, PAST_DAYS), [today]));

  return (
    <div className="settings-page">
      <SubpageHero
        eyebrow="Set your direction"
        title="Intentions & priorities"
        parent={{ to: '/settings', label: 'Settings' }}
      />

      <DailyPriorities date={today} />
      <DailyIntention date={today} />

      <Section title="Coming up" icon={CalendarClock} className="settings-group">
        <LiveView state={next}>
          {(items) =>
            items.length === 0 ? (
              <p className="quiet-note">
                Your reviews set the focus for tomorrow, next week, and next month.{' '}
                <Link to={`/review/daily/${today}`}>Start today’s review</Link>
              </p>
            ) : (
              <SettingsCard>
                {items.map(({ period, focus }) => (
                  <SettingsRow
                    key={period.type}
                    icon={Compass}
                    tone="ocean"
                    title={`Focus for ${NEXT_PERIOD_NAME[period.type]}`}
                    description={
                      <>
                        {focus} <Link to={reviewPath(period)}>Open review</Link>
                      </>
                    }
                  />
                ))}
              </SettingsCard>
            )
          }
        </LiveView>
      </Section>

      <Section title="Earlier" icon={History} className="settings-group">
        <LiveView state={past}>
          {(plans) =>
            plans.length === 0 ? (
              <p className="quiet-note">Past intentions and priorities will collect here.</p>
            ) : (
              <SettingsCard>
                {plans.map((plan) => (
                  <SettingsRow
                    key={plan.id}
                    icon={Target}
                    tone="slate"
                    title={formatDateKey(plan.date, undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                    description={
                      <>
                        {plan.intention.trim() !== '' && <em>{plan.intention}</em>}
                        {plan.topOutcomes.length > 0 && (
                          <span className="past-focus">
                            {plan.topOutcomes.map((o) => (
                              <span key={o.id} className="past-focus__item">
                                {o.done ? (
                                  <CircleCheck size={13} role="img" aria-label="Done" />
                                ) : (
                                  <Circle size={13} role="img" aria-label="Not done" />
                                )}
                                {o.text}
                              </span>
                            ))}
                          </span>
                        )}
                      </>
                    }
                  />
                ))}
              </SettingsCard>
            )
          }
        </LiveView>
      </Section>
    </div>
  );
}
