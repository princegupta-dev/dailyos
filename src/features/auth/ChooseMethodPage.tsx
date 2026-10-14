import { ChevronRight, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { AuthLink, AuthScreen, AuthSwitch, GoogleMark } from './AuthUi';
import { AUTH_ROUTES } from './authRoutes';

/** Login: Google or email, the only two ways into DailyOS. */
export function ChooseMethodPage() {
  return (
    <AuthScreen
      title="How would you like to continue?"
      subtitle="Choose a sign-in method to access DailyOS."
      back={{ to: AUTH_ROUTES.welcome, label: 'Back to welcome' }}
      footer={
        <AuthSwitch
          prompt="New to DailyOS?"
          to={AUTH_ROUTES.createAccount}
          label="Create account"
          caps
          replace
        />
      }
    >
      <ul className="method-list">
        <MethodOption
          to={AUTH_ROUTES.google}
          icon={<GoogleMark size={24} />}
          title="Continue with Google"
          description="Quick, secure and easy."
        />
        <MethodOption
          to={AUTH_ROUTES.signIn}
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
      <AuthLink to={to} className="method-option">
        <span className="method-option__icon">{icon}</span>
        <span className="method-option__text">
          <span className="method-option__title">{title}</span>
          <span className="method-option__description">{description}</span>
        </span>
        <ChevronRight size={18} className="method-option__chevron" aria-hidden="true" />
      </AuthLink>
    </li>
  );
}
