import {
  ChartNoAxesColumn,
  CircleCheckBig,
  House,
  NotebookPen,
  type LucideIcon,
} from 'lucide-react';
import { Link, useLocation } from 'react-router';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Path prefixes that belong to this destination (secondary screens included). */
  matches: readonly string[];
}

/**
 * Four primary destinations. Secondary screens keep their parent highlighted: Tasks is
 * reached from Today, Learn from Insights, Settings from Today.
 */
const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Today', icon: House, matches: ['/tasks', '/settings'] },
  { to: '/habits', label: 'Habits', icon: CircleCheckBig, matches: ['/habits'] },
  { to: '/insights', label: 'Insights', icon: ChartNoAxesColumn, matches: ['/insights', '/learn'] },
  { to: '/review', label: 'Review', icon: NotebookPen, matches: ['/review'] },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/' && pathname === '/') return true;
  return item.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * The app's tab bar: docked to the bottom on phones, a side rail on wider screens. The active
 * tab's icon sits in a brand-gradient pill that grows in when the tab is chosen.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <ul className="bottom-nav__list">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className="bottom-nav__link"
                aria-current={active ? 'page' : undefined}
              >
                <span className="bottom-nav__icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span className="bottom-nav__label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
