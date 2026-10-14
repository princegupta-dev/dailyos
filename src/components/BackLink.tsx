import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

/** The back arrow on a screen reached from a hub, leading to its parent (e.g. "Back to Settings"). */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="icon-button" aria-label={label}>
      <ArrowLeft size={20} aria-hidden="true" />
    </Link>
  );
}
