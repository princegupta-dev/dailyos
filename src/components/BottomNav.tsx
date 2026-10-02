import { BookOpen, ListChecks, NotebookPen, Sun, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/review', label: 'Review', icon: NotebookPen },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <ul className="bottom-nav__list">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink to={to} end={to === '/'} className="bottom-nav__link">
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
