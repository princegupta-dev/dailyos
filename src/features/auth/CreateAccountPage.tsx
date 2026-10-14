import { CircleAlert } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { TextField } from '@/components/form';
import { createAccount } from '@/services/auth.service';
import { AuthScreen, AuthSwitch, PasswordField, PasswordRules, Spinner } from './AuthUi';
import { AUTH_ROUTES } from './authRoutes';
import { confirmPasswordError, emailError, newPasswordError } from './credentials';
import { useSession } from './session-context';

type Field = 'name' | 'email' | 'password' | 'confirm';

/** A new email-and-password account. */
export function CreateAccountPage() {
  const { begin } = useSession();
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<Field, string>>({
    name: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string | undefined>>>({});
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);

  const set = (field: Field) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
  };

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    const next: Partial<Record<Field, string | undefined>> = {
      name: values.name.trim() === '' ? 'Enter your name.' : undefined,
      email: emailError(values.email),
      password: newPasswordError(values.password),
      confirm: confirmPasswordError(values.password, values.confirm),
    };
    setErrors(next);
    setFailure(undefined);
    if (Object.values(next).some(Boolean)) return;
    setPending(true);
    try {
      begin(await createAccount(values));
      void navigate(AUTH_ROUTES.success, { replace: true });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Couldn’t create your account.');
      setPending(false);
    }
  };

  return (
    <AuthScreen
      title="Create your account"
      subtitle="Let’s get you started with DailyOS."
      back={{ to: AUTH_ROUTES.welcome, label: 'Back to welcome' }}
      footer={
        <AuthSwitch
          prompt="Already have an account?"
          to={AUTH_ROUTES.login}
          label="Login"
          caps
          replace
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
          label="Name"
          autoComplete="name"
          placeholder="Your full name"
          maxLength={60}
          value={values.name}
          error={errors.name}
          onChange={set('name')}
        />
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          error={errors.email}
          onChange={set('email')}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={values.password}
          error={errors.password}
          onChange={set('password')}
        >
          <PasswordRules password={values.password} />
        </PasswordField>
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Type it again"
          value={values.confirm}
          error={errors.confirm}
          onChange={set('confirm')}
        />
        <button type="submit" className="button button--gradient button--block" disabled={pending}>
          {pending ? (
            <>
              <Spinner /> Creating account…
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>
    </AuthScreen>
  );
}
