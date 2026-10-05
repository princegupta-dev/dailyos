import {
  BellOff,
  CalendarDays,
  Clock,
  Feather,
  MessageSquareQuote,
  Repeat,
  Settings2,
  Shuffle,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, type ReactNode } from 'react';
import { listReflectionsForSubject } from '@/db/repositories/reflections';
import { describeWhen } from '@/domain/appearance';
import { describeSchedule, describeTarget, type Habit } from '@/domain/habit';
import { useLiveData } from '@/hooks/useLiveData';
import { relativeDayLabel } from '@/lib/format';

/* ---------- Setup ---------- */

/** How the habit is set up: when it repeats, the goal, its anchor, and what else counts. */
export function HabitSetupCard({ habit, today }: { habit: Habit; today: string }) {
  const target = describeTarget(habit);
  const when = describeWhen(habit);
  return (
    <section className="detail-card setup" aria-labelledby="setup-title">
      <div className="detail-card__head">
        <h2 id="setup-title" className="detail-card__title">
          <Settings2 size={17} aria-hidden="true" /> Setup
        </h2>
      </div>
      <dl className="setup__list">
        <SetupRow icon={Repeat} label="Schedule" value={describeSchedule(habit)} />
        <SetupRow icon={Target} label="Target" value={target ?? 'None — doing it counts'} />
        <SetupRow
          icon={Clock}
          label="When"
          value={when ?? 'Anytime'}
          note={
            when ? (
              <span className="setup__note">
                <BellOff size={12} aria-hidden="true" /> Shown as an anchor, never notified
              </span>
            ) : undefined
          }
        />
        <SetupRow
          icon={CalendarDays}
          label={habit.startDate > today ? 'Starts' : 'Started'}
          value={relativeDayLabel(habit.startDate, today)}
        />
      </dl>

      {(habit.minimumTarget || habit.alternatives) && (
        <div className="setup__flex">
          <p className="setup__flex-title">Also counts as done</p>
          {habit.minimumTarget && (
            <p className="setup__flex-row">
              <span className="setup__flex-icon" aria-hidden="true">
                <Feather size={14} />
              </span>
              <span>
                <span className="setup__flex-label">On a hard day</span>
                <span className="setup__flex-value">{habit.minimumTarget}</span>
              </span>
            </p>
          )}
          {habit.alternatives && (
            <div className="setup__flex-row">
              <span className="setup__flex-icon" aria-hidden="true">
                <Shuffle size={14} />
              </span>
              <span>
                <span className="setup__flex-label">Or instead</span>
                <span className="setup__alts">
                  {habit.alternatives.map((alt) => (
                    <span key={alt} className="tag">
                      {alt}
                    </span>
                  ))}
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SetupRow({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: ReactNode;
}) {
  return (
    <div className="setup__row">
      <dt className="setup__label">
        <span className="setup__icon" aria-hidden="true">
          <Icon size={14} />
        </span>
        {label}
      </dt>
      <dd className="setup__value">
        {value}
        {note}
      </dd>
    </div>
  );
}

/* ---------- Reflections ---------- */

const REFLECTIONS_SHOWN = 3;

/** The latest evening-review reflections written about this habit. */
export function HabitReflectionsCard({ habit, today }: { habit: Habit; today: string }) {
  const reflections = useLiveData(
    useCallback(
      () => listReflectionsForSubject({ type: 'habit', id: habit.id }, REFLECTIONS_SHOWN),
      [habit.id],
    ),
  );
  const rows = reflections.status === 'ready' ? reflections.data : [];

  return (
    <section className="detail-card reflections" aria-labelledby="reflections-title">
      <div className="detail-card__head">
        <h2 id="reflections-title" className="detail-card__title">
          <MessageSquareQuote size={17} aria-hidden="true" /> Reflections
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="reflections__empty">
          Rate this habit and note what helped in your <em>evening review</em>. Your last few
          reflections will gather here.
        </p>
      ) : (
        <ul className="reflections__list">
          {rows.map((r) => (
            <li key={r.id} className="reflections__item">
              <div className="reflections__head">
                <span className="reflections__date">{relativeDayLabel(r.date, today)}</span>
                {r.rating !== undefined && (
                  <span
                    className="reflections__rating"
                    role="img"
                    aria-label={`Rated ${r.rating} of 5`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`reflections__pip${n <= (r.rating ?? 0) ? ' reflections__pip--on' : ''}`}
                      />
                    ))}
                  </span>
                )}
              </div>
              {r.wentWell && (
                <p className="reflections__line reflections__line--well">
                  <span className="reflections__tag">Went well</span> {r.wentWell}
                </p>
              )}
              {r.gotInTheWay && (
                <p className="reflections__line reflections__line--way">
                  <span className="reflections__tag">In the way</span> {r.gotInTheWay}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Ending ---------- */

/** A quiet, clearly separated place to end the habit. */
export function EndHabitCard({ onEnd }: { onEnd: () => void }) {
  return (
    <section className="detail-card end-habit" aria-labelledby="end-habit-title">
      <h2 id="end-habit-title" className="detail-card__title">
        End habit
      </h2>
      <p className="end-habit__text">
        Ending stops it from today. Its history stays in your insights and reviews.
      </p>
      <button
        type="button"
        className="button button--secondary button--compact end-habit__button"
        onClick={onEnd}
      >
        End habit
      </button>
    </section>
  );
}
