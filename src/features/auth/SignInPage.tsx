import { CircleAlert } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { TextField } from '@/components/form';
import { signInWithEmail } from '@/services/auth.service';
import { AuthScreen, AuthSwitch, PasswordField, Spinner } from './AuthUi';
import { emailError } from './credentials';
import { useSession } from './session-context';

/** Email and password sign-in for an existing account. */
export function SignInPage() {
  const { begin } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{
    email?: string | undefined;
    password?: string | undefined;
  }>({});
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    const next = {
      email: emailError(email),
      password: password === '' ? 'Enter your password.' : undefined,
    };
    setErrors(next);
    setFailure(undefined);
    if (next.email || next.password) return;
    setPending(true);
    try {
      begin(await signInWithEmail(email, password));
      void navigate('/auth/success', { replace: true });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Couldn’t sign in. Try again.');
      setPending(false);
    }
  };

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to continue to your space."
      back={{ to: '/auth', label: 'Back to sign-in options' }}
      footer={
        <AuthSwitch
          prompt="Don’t have an account?"
          to="/auth/create-account"
          label="Create account"
        />
      }
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
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          error={errors.password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
        <Link to="/auth/forgot-password" className="auth-forgot">
          Forgot password?
        </Link>
        <button type="submit" className="button button--primary button--block" disabled={pending}>
          {pending ? (
            <>
              <Spinner /> Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </AuthScreen>
  );
}
