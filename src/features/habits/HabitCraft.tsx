import { Feather, Link2, RotateCcw, type LucideIcon } from 'lucide-react';
import { useId } from 'react';

const PRINCIPLES: readonly { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Feather,
    title: 'Start tiny',
    text: 'Make it easy enough to do on your worst day. Grow it later.',
  },
  {
    icon: Link2,
    title: 'Anchor it',
    text: 'Attach it to something you already do: after coffee, before bed.',
  },
  {
    icon: RotateCcw,
    title: 'Never miss twice',
    text: 'One missed day is life. Two starts a new pattern. Just come back.',
  },
];

/** Three small principles for building habits that last. */
export function HabitCraft() {
  const titleId = useId();
  return (
    <aside className="habit-craft" aria-labelledby={titleId}>
      <p id={titleId} className="habit-craft__title">
        Habit <em>craft</em>
      </p>
      <ul className="habit-craft__list">
        {PRINCIPLES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="habit-craft__item">
            <span className="habit-craft__icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span>
              <span className="habit-craft__name">{title}</span>
              <span className="habit-craft__text">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
