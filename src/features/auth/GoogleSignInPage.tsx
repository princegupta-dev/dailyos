import { CircleAlert, KeyRound, Lock, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { signInWithGoogle } from '@/services/auth.service';
import { AuthLink, AuthScreen, GoogleMark, Spinner } from './AuthUi';
import { AUTH_ROUTES } from './authRoutes';
import { useSession } from './session-context';

const BENEFITS: readonly { icon: LucideIcon; text: string }[] = [
  { icon: ShieldCheck, text: 'Quick and secure sign in' },
  { icon: KeyRound, text: 'No separate password to remember' },
  { icon: Lock, text: 'All your data stays private' },
];

type Status = { kind: 'idle' } | { kind: 'connecting' } | { kind: 'error'; message: string };

/**
 * Google sign-in. For now this simulates the round trip to Google; the real OAuth redirect
 * replaces `signInWithGoogle` without changing this screen.
 */
export function GoogleSignInPage() {
  const { begin } = useSession();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const connect = async () => {
    setStatus({ kind: 'connecting' });
    try {
      begin(await signInWithGoogle());
      void navigate(AUTH_ROUTES.success, { replace: true });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Google sign-in didn’t finish.',
      });
    }
  };

  return (
    <AuthScreen
      centered
      back={{ to: AUTH_ROUTES.login, label: 'Back to login' }}
      art={
        <span className="status-tile status-tile--google" aria-hidden="true">
          <GoogleMark size={40} />
        </span>
      }
      title="Continue with Google"
      subtitle="You’ll be redirected to Google to sign in securely."
      footer={
        <p className="auth-switch">
          Prefer email?{' '}
          <AuthLink to={AUTH_ROUTES.signIn} replace className="auth-switch__action">
            Sign in with email
          </AuthLink>
        </p>
      }
    >
      <ul className="benefit-list">
        {BENEFITS.map(({ icon: Icon, text }) => (
          <li key={text}>
            <span className="benefit-list__icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            {text}
          </li>
        ))}
      </ul>

      {status.kind === 'error' && (
        <p className="inline-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" /> {status.message}
        </p>
      )}

      <button
        type="button"
        className="button button--gradient button--block"
        disabled={status.kind === 'connecting'}
        onClick={() => void connect()}
      >
        {status.kind === 'connecting' ? (
          <>
            <Spinner /> Connecting to Google…
          </>
        ) : (
          <>
            <GoogleMark /> {status.kind === 'error' ? 'Try again' : 'Continue with Google'}
          </>
        )}
      </button>
      <p className="sr-status visually-hidden" role="status">
        {status.kind === 'connecting' ? 'Connecting to Google' : ''}
      </p>
    </AuthScreen>
  );
}
