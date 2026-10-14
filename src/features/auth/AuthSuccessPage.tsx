import { Check } from 'lucide-react';
import { Link } from 'react-router';
import { AuthScreen } from './AuthUi';
import { useSession } from './session-context';

/** Shown right after signing in or creating an account. */
export function AuthSuccessPage() {
  const { session, finishProfileSetup } = useSession();
  const needsSetup = session ? !session.profileSetupDone : false;
  const firstName = session?.user.name.split(' ')[0];

  return (
    <AuthScreen
      centered
      art={
        <div className="success-art" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={`success-art__dot success-art__dot--${String(i + 1)}`} />
          ))}
          <span className="status-tile status-tile--success">
            <Check size={34} strokeWidth={2.5} />
          </span>
        </div>
      }
      title={needsSetup ? 'You’re in!' : `Welcome back${firstName ? `, ${firstName}` : ''}!`}
      subtitle={
        needsSetup
          ? 'Your account is ready. Let’s set up your profile to personalise your experience.'
          : 'You’re signed in. Pick up right where you left off.'
      }
    >
      <div className="auth-actions">
        {needsSetup ? (
          <>
            <Link to="/onboarding" className="button button--primary button--block">
              Continue to profile setup
            </Link>
            <Link to="/" className="link-button link-button--center" onClick={finishProfileSetup}>
              Skip for now
            </Link>
          </>
        ) : (
          <Link to="/" className="button button--primary button--block">
            Go to dashboard
          </Link>
        )}
      </div>
    </AuthScreen>
  );
}
