import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  eyebrow?: string | undefined;
  description?: string | undefined;
  /** Shown before the title, like a mobile app bar's back button. */
  leading?: ReactNode;
  actions?: ReactNode;
}

/** Sticky, elevated app bar at the top of each screen. */
export function PageHeader({ title, eyebrow, description, leading, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      {leading && <div className="page-header__leading">{leading}</div>}
      <div className="page-header__text">
        {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
