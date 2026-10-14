import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

interface SubpageHeroProps {
  title: string;
  eyebrow: string;
  /** The hub this screen belongs to, e.g. Settings or Profile. */
  parent: { to: string; label: string };
}

/** The title of a screen opened from the Settings or Profile hub, with a way back to it. */
export function SubpageHero({ title, eyebrow, parent }: SubpageHeroProps) {
  return (
    <header className="settings-hero">
      <Link to={parent.to} className="settings-hero__back" aria-label={`Back to ${parent.label}`}>
        <ArrowLeft size={20} aria-hidden="true" />
      </Link>
      <div className="settings-hero__text">
        <p className="settings-hero__eyebrow">{eyebrow}</p>
        <h1 className="settings-hero__title">{title}</h1>
      </div>
    </header>
  );
}
