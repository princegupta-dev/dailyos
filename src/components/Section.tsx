import type { LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';

interface SectionProps {
  title: string;
  meta?: ReactNode;
  /** Optional icon shown in a soft tile beside the title. */
  icon?: LucideIcon | undefined;
  /** Optional one-line subtitle under the title. */
  description?: string | undefined;
  /** Extra class names, e.g. a visual variant like `section--card`. */
  className?: string | undefined;
  children: ReactNode;
}

export function Section({
  title,
  meta,
  icon: Icon,
  description,
  className,
  children,
}: SectionProps) {
  const headingId = useId();
  return (
    <section className={`section${className ? ` ${className}` : ''}`} aria-labelledby={headingId}>
      <div className="section__header">
        <div className="section__heading">
          {Icon && (
            <span className="section__icon" aria-hidden="true">
              <Icon size={18} />
            </span>
          )}
          <div className="section__titles">
            <h2 id={headingId} className="section__title">
              {title}
            </h2>
            {description && <p className="section__description">{description}</p>}
          </div>
        </div>
        {meta !== undefined && <span className="section__meta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
