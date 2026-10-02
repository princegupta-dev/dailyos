import { useId, type ReactNode } from 'react';

interface SectionProps {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}

export function Section({ title, meta, children }: SectionProps) {
  const headingId = useId();
  return (
    <section className="section" aria-labelledby={headingId}>
      <div className="section__header">
        <h2 id={headingId} className="section__title">
          {title}
        </h2>
        {meta !== undefined && <span className="section__meta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
