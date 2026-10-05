import { CloudRain, ChevronDown, Leaf, Sparkles, SquareCheckBig } from 'lucide-react';
import { useCallback, useId, useState, type SyntheticEvent } from 'react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { TextAreaField } from '@/components/form';
import { LiveView } from '@/components/LiveView';
import { Section } from '@/components/Section';
import { listReflectionsForDate, saveItemReflection } from '@/db/repositories/reflections';
import type { HabitIconKey, HabitTone } from '@/domain/appearance';
import type { HabitCategory } from '@/domain/categories';
import type { OccurrenceStatus } from '@/domain/habit';
import { OUTCOME_LABELS, type PlanItemOutcome } from '@/domain/plan';
import { reflectionKey, type ItemReflection, type ReflectionSubject } from '@/domain/reflection';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';
import { inlineDayLabel } from '@/lib/format';
import type { DailySummary } from '@/services/analytics.service';
import { RatingField } from './RatingField';
import { RatingPips } from './RatingPips';

const HABIT_STATUS: Record<OccurrenceStatus, string> = {
  completed: 'Done',
  skipped: 'Skipped',
  missed: 'Missed',
  pending: 'Not yet',
};

/** How each item's day went, as a colored dot beside its status. */
type Outcome = 'done' | 'missed' | 'skipped' | 'open';

const HABIT_OUTCOME: Record<OccurrenceStatus, Outcome> = {
  completed: 'done',
  skipped: 'skipped',
  missed: 'missed',
  pending: 'open',
};

const TASK_OUTCOME: Record<PlanItemOutcome, Outcome> = {
  done: 'done',
  not_done: 'missed',
  rescheduled: 'skipped',
  cancelled: 'skipped',
  open: 'open',
};

interface ReflectionItem {
  subject: ReflectionSubject;
  key: string;
  name: string;
  /** What happened with it that day, e.g. "Done" or "Rescheduled to tomorrow". */
  status: string;
  outcome: Outcome;
  /** Set for habits, which show their category tile (with their own icon and tone). */
  category?: HabitCategory | undefined;
  icon?: HabitIconKey | undefined;
  tone?: HabitTone | undefined;
}

/**
 * The habits and tasks of `date` that can be reflected on: the day's habits, its planned
 * tasks, tasks finished without being planned, and anything already reflected on that has
 * since left the day (a task moved off the plan, say), so no reflection is ever hidden.
 */
function itemsForDay(
  summary: DailySummary,
  today: string,
  saved: readonly { reflection: ItemReflection; name: string | undefined }[],
): { habits: ReflectionItem[]; tasks: ReflectionItem[] } {
  const habits: ReflectionItem[] = summary.habits.map((h) => ({
    subject: { type: 'habit', id: h.habitId },
    key: reflectionKey({ type: 'habit', id: h.habitId }),
    name: h.name,
    status: `${HABIT_STATUS[h.status]}${h.weekly ? ' this week' : ''}`,
    outcome: HABIT_OUTCOME[h.status],
    category: h.category,
    icon: h.icon,
    tone: h.tone,
  }));
  const tasks: ReflectionItem[] = [
    ...summary.planned.map((p) => ({
      subject: { type: 'task', id: p.taskId } as const,
      key: reflectionKey({ type: 'task', id: p.taskId }),
      name: p.title,
      status:
        OUTCOME_LABELS[p.outcome] +
        (p.rescheduledTo ? ` to ${inlineDayLabel(p.rescheduledTo, today)}` : ''),
      outcome: TASK_OUTCOME[p.outcome],
    })),
    ...summary.unplannedCompleted.map((t) => ({
      subject: { type: 'task', id: t.taskId } as const,
      key: reflectionKey({ type: 'task', id: t.taskId }),
      name: t.title,
      status: 'Done, not planned',
      outcome: 'done' as const,
    })),
  ];

  const listed = new Set([...habits, ...tasks].map((i) => i.key));
  for (const { reflection, name } of saved) {
    const subject: ReflectionSubject = { type: reflection.subjectType, id: reflection.subjectId };
    const key = reflectionKey(subject);
    if (listed.has(key)) continue;
    listed.add(key);
    const isHabit = subject.type === 'habit';
    (isHabit ? habits : tasks).push({
      subject,
      key,
      name: name ?? (isHabit ? 'Deleted habit' : 'Deleted task'),
      status: isHabit ? 'Not scheduled this day' : 'No longer planned this day',
      outcome: 'open',
    });
  }
  return { habits, tasks };
}

/** One reflection per habit and per task for `date`, each rated and saved on its own. */
export function ItemReflections({
  date,
  today,
  summary,
}: {
  date: string;
  today: string;
  summary: DailySummary;
}) {
  const saved = useLiveData(useCallback(() => listReflectionsForDate(date), [date]));
  return (
    <LiveView state={saved}>
      {(rows) => (
        <ReflectionList
          date={date}
          {...itemsForDay(summary, today, rows)}
          reflections={
            new Map(
              rows.map(({ reflection }) => [
                reflectionKey({ type: reflection.subjectType, id: reflection.subjectId }),
                reflection,
              ]),
            )
          }
        />
      )}
    </LiveView>
  );
}

function ReflectionList({
  date,
  habits,
  tasks,
  reflections,
}: {
  date: string;
  habits: ReflectionItem[];
  tasks: ReflectionItem[];
  reflections: Map<string, ItemReflection>;
}) {
  const all = [...habits, ...tasks];
  const firstOpen = (exclude?: string) =>
    all.find((i) => i.key !== exclude && !reflections.has(i.key))?.key ?? null;
  // One card is open at a time. It starts on the first item without a reflection, and saving
  // one moves on to the next, so the day can be reviewed item by item.
  const [openKey, setOpenKey] = useState<string | null>(() => firstOpen());

  if (all.length === 0) {
    return (
      <Section title="Reflections" icon={Sparkles}>
        <p className="quiet-note">
          No habits or tasks for this day. Plan tasks or add habits to reflect on them here.
        </p>
      </Section>
    );
  }

  const reflected = all.filter((i) => reflections.has(i.key)).length;
  const card = (item: ReflectionItem) => (
    <ReflectionCard
      key={item.key}
      item={item}
      date={date}
      reflection={reflections.get(item.key)}
      open={openKey === item.key}
      onToggle={() => {
        setOpenKey((current) => (current === item.key ? null : item.key));
      }}
      onSaved={() => {
        setOpenKey(firstOpen(item.key));
      }}
    />
  );

  return (
    <Section
      title="Reflections"
      icon={Sparkles}
      description="A rating, what helped, what got in the way."
      meta={`${reflected} of ${all.length} reflected`}
      className="section--reflections"
    >
      <div
        className={`reflect-progress${reflected === all.length ? ' reflect-progress--complete' : ''}`}
        aria-hidden="true"
      >
        <span style={{ inlineSize: `${Math.round((reflected / all.length) * 100)}%` }} />
      </div>
      {reflected === all.length && (
        <p className="reflect-complete">
          <Sparkles size={15} aria-hidden="true" />
          <span>
            Every item reflected on. <em>That’s a well-kept day.</em>
          </span>
        </p>
      )}
      {habits.length > 0 && (
        <div className="reflection-group">
          <h3 className="reflection-group__title">
            Habits <span className="reflection-group__count">{habits.length}</span>
          </h3>
          <ul className="reflection-list" aria-label="Habit reflections">
            {habits.map(card)}
          </ul>
        </div>
      )}
      {tasks.length > 0 && (
        <div className="reflection-group">
          <h3 className="reflection-group__title">
            Tasks <span className="reflection-group__count">{tasks.length}</span>
          </h3>
          <ul className="reflection-list" aria-label="Task reflections">
            {tasks.map(card)}
          </ul>
        </div>
      )}
    </Section>
  );
}

function ReflectionCard({
  item,
  date,
  reflection,
  open,
  onToggle,
  onSaved,
}: {
  item: ReflectionItem;
  date: string;
  reflection: ItemReflection | undefined;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const bodyId = useId();
  const kind = item.subject.type === 'habit' ? 'Habit' : 'Task';
  return (
    <li
      className={`reflection-card${reflection ? ' reflection-card--done' : ''}${open ? ' reflection-card--open' : ''}`}
    >
      <h4 className="reflection-card__heading">
        <button
          type="button"
          className="reflection-card__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          {item.category !== undefined ? (
            <CategoryIcon category={item.category} icon={item.icon} tone={item.tone} size="sm" />
          ) : (
            <span className="category-icon category-icon--sm reflection-card__task-icon">
              <SquareCheckBig size={16} aria-hidden="true" />
            </span>
          )}
          <span className="reflection-card__text">
            <span className="reflection-card__name">{item.name}</span>
            <span className={`reflection-card__meta reflection-card__meta--${item.outcome}`}>
              {kind} · {item.status}
            </span>
          </span>
          <span className="reflection-card__status">
            {reflection ? (
              reflection.rating !== undefined ? (
                <RatingPips rating={reflection.rating} />
              ) : (
                'Reflected'
              )
            ) : (
              'To reflect'
            )}
          </span>
          <ChevronDown className="reflection-card__chevron" size={18} aria-hidden="true" />
        </button>
      </h4>
      <div
        id={bodyId}
        className="reflection-card__body"
        role="group"
        aria-label={`Reflection on ${item.name}`}
        hidden={!open}
      >
        {/* Remount after each save so the draft restarts from what was stored. */}
        <ReflectionForm
          key={reflection?.updatedAt ?? 'new'}
          item={item}
          date={date}
          reflection={reflection}
          onSaved={onSaved}
        />
      </div>
    </li>
  );
}

function ReflectionForm({
  item,
  date,
  reflection,
  onSaved,
}: {
  item: ReflectionItem;
  date: string;
  reflection: ItemReflection | undefined;
  onSaved: () => void;
}) {
  const { run, pending } = useAction();
  const [rating, setRating] = useState(reflection?.rating);
  const [wentWell, setWentWell] = useState(reflection?.wentWell ?? '');
  const [gotInTheWay, setGotInTheWay] = useState(reflection?.gotInTheWay ?? '');
  const empty = rating === undefined && wentWell.trim() === '' && gotInTheWay.trim() === '';

  const save = async (event: SyntheticEvent) => {
    event.preventDefault();
    const result = await run(
      () => saveItemReflection(item.subject, date, { rating, wentWell, gotInTheWay }),
      empty ? 'Reflection cleared' : `Saved reflection on ${item.name}`,
    );
    if (result.ok) onSaved();
  };

  const clear = async () => {
    const result = await run(
      () => saveItemReflection(item.subject, date, {}),
      'Reflection cleared',
    );
    if (result.ok) onSaved();
  };

  return (
    <form className="form reflect-form" onSubmit={(e) => void save(e)} noValidate>
      <RatingField
        legend="How did it go?"
        groupLabel={`Rating for ${item.name}`}
        value={rating}
        onChange={setRating}
      />
      <div className="reflect-prompt reflect-prompt--well">
        <span className="reflect-prompt__icon" aria-hidden="true">
          <Leaf size={15} />
        </span>
        <TextAreaField
          label="What went well today?"
          rows={2}
          maxLength={2000}
          placeholder="A small win counts…"
          value={wentWell}
          onChange={(e) => {
            setWentWell(e.target.value);
          }}
        />
      </div>
      <div className="reflect-prompt reflect-prompt--way">
        <span className="reflect-prompt__icon" aria-hidden="true">
          <CloudRain size={15} />
        </span>
        <TextAreaField
          label="What got in the way?"
          hint="One per line helps spot repeats in weekly reviews"
          rows={2}
          maxLength={2000}
          placeholder="Be honest, and kind…"
          value={gotInTheWay}
          onChange={(e) => {
            setGotInTheWay(e.target.value);
          }}
        />
      </div>
      <div className="form__actions reflect-form__actions">
        {reflection && (
          <button
            type="button"
            className="button button--secondary button--compact"
            disabled={pending}
            onClick={() => void clear()}
          >
            Clear
          </button>
        )}
        <button
          type="submit"
          className="button button--primary button--compact reflect-form__save"
          disabled={pending || (empty && !reflection)}
        >
          {reflection ? 'Save changes' : 'Save reflection'}
        </button>
      </div>
    </form>
  );
}
