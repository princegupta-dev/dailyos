import { CircleAlert, KeyRound } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { Link } from 'react-router';
import { TextField } from '@/components/form';
import { requestPasswordReset } from '@/services/auth.service';
import { AuthScreen, Spinner } from './AuthUi';
import { emailError } from './credentials';

/**
 * Forgot password — UI only. No email is sent: password reset will arrive with the real
 * sign-in service, and the screen says so plainly once the form is submitted.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    const problem = emailError(email);
    setError(problem);
    setFailure(undefined);
    if (problem) return;
    setPending(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setPending(false);
    }
  };

  if (submitted) {
    return (
      <AuthScreen
        centered
        art={
          <span className="status-tile" aria-hidden="true">
            <KeyRound size={30} />
          </span>
        }
        title="Password reset is coming soon"
        subtitle={
          <>
            We noted your request for <strong>{email.trim()}</strong>, but resetting a password
            isn’t available yet. For now, sign in with Google or create a new account.
          </>
        }
      >
        <div className="auth-actions">
          <Link to="/auth/sign-in" className="button button--primary button--block">
            Back to sign in
          </Link>
          <Link to="/auth/google" className="button button--secondary button--block">
            Continue with Google
          </Link>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Forgot password?"
      subtitle="Enter the email you signed up with and we’ll help you get back in."
      back={{ to: '/auth/sign-in', label: 'Back to sign in' }}
    >
      <form className="form" onSubmit={(e) => void submit(e)} noValidate>
        {failure && (
          <p className="inline-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" /> {failure}
          </p>
        )}
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          error={error}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
        <button type="submit" className="button button--primary button--block" disabled={pending}>
          {pending ? (
            <>
              <Spinner /> Checking…
            </>
          ) : (
            'Reset password'
          )}
        </button>
      </form>
    </AuthScreen>
  );
}
