import { ChevronRight, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AuthScreen, GoogleMark } from './AuthUi';

/** Google or email: the only two ways into DailyOS. */
export function ChooseMethodPage() {
  return (
    <AuthScreen
      title="How would you like to continue?"
      subtitle="Choose a sign-in method to access DailyOS."
      back={{ to: '/welcome', label: 'Back to welcome' }}
    >
      <ul className="method-list">
        <MethodOption
          to="/auth/google"
          icon={<GoogleMark size={24} />}
          title="Continue with Google"
          description="Quick, secure and easy."
        />
        <MethodOption
          to="/auth/sign-in"
          icon={<Mail size={22} aria-hidden="true" />}
          title="Continue with Email"
          description="Use your email and password."
        />
      </ul>
    </AuthScreen>
  );
}

function MethodOption({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li>
      <Link to={to} className="method-option">
        <span className="method-option__icon">{icon}</span>
        <span className="method-option__text">
          <span className="method-option__title">{title}</span>
          <span className="method-option__description">{description}</span>
        </span>
        <ChevronRight size={18} className="method-option__chevron" aria-hidden="true" />
      </Link>
    </li>
  );
}
