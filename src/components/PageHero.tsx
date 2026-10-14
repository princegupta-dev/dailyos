import type { ReactNode } from 'react';

interface PageHeroProps {
  title: string;
  /** Small italic line above the title, e.g. today's date. */
  eyebrow?: string | undefined;
  /** One short italic line under the title. */
  subtitle?: ReactNode;
  /** Shown before the title, e.g. a back link to the parent screen. */
  leading?: ReactNode;
  actions?: ReactNode;
}

/**
 * The large, open page title used on top-level screens (Today's header in the same style).
 * Unlike PageHeader it isn't a sticky bar: it scrolls away with the page.
 */
export function PageHero({ title, eyebrow, subtitle, leading, actions }: PageHeroProps) {
  return (
    <header className="page-hero">
      {leading && <div className="page-hero__leading">{leading}</div>}
      <div className="page-hero__text">
        {eyebrow && <p className="page-hero__eyebrow">{eyebrow}</p>}
        <h1 className="page-hero__title">{title}</h1>
        {subtitle && <p className="page-hero__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-hero__actions">{actions}</div>}
    </header>
  );
}
