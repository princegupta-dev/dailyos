import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { HabitTone } from '@/domain/appearance';

/** A grouped card of settings rows, as in a native settings app. */
export function SettingsCard({ children }: { children: ReactNode }) {
  return <ul className="settings-card">{children}</ul>;
}

interface RowProps {
  icon: LucideIcon;
  tone?: HabitTone | undefined;
}

function RowIcon({ icon: Icon, tone = 'sage' }: RowProps) {
  return (
    <span className={`settings-row__icon tone--${tone}`} aria-hidden="true">
      <Icon size={17} />
    </span>
  );
}

/** A row that leads somewhere else in the app. */
export function SettingsLinkRow({
  to,
  title,
  description,
  ...icon
}: RowProps & { to: string; title: string; description: string }) {
  return (
    <li>
      <Link to={to} className="settings-row settings-row--link">
        <RowIcon {...icon} />
        <span className="settings-row__text">
          <span className="settings-row__title">{title}</span>
          <span className="settings-row__description">{description}</span>
        </span>
        <ChevronRight className="settings-row__chevron" size={18} aria-hidden="true" />
      </Link>
    </li>
  );
}

/** A row holding a control (a field, a button) or a short explanation. */
export function SettingsRow({
  title,
  description,
  children,
  ...icon
}: RowProps & { title?: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <li className="settings-row">
      <RowIcon {...icon} />
      <div className="settings-row__text">
        {title && <p className="settings-row__title">{title}</p>}
        {description && <p className="settings-row__description">{description}</p>}
        {children}
      </div>
    </li>
  );
}
