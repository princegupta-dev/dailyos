import { AtSign, KeyRound, LogIn, MonitorSmartphone } from 'lucide-react';
import { useContext, useState, type SyntheticEvent } from 'react';
import { Section } from '@/components/Section';
import { ToastContext } from '@/components/toast-context';
import { changePassword } from '@/services/auth.service';
import { PasswordField, PasswordRules, Spinner } from '../auth/AuthUi';
import { confirmPasswordError, newPasswordError } from '../auth/credentials';
import { useSession } from '../auth/session-context';
import { SettingsCard, SettingsRow } from '../settings/SettingsRow';
import { SubpageHero } from '../settings/SubpageHero';

/** How you sign in, and changing your password (for email accounts). */
export function AccountSecurityPage() {
  const { session } = useSession();
  const isGoogle = session?.user.provider === 'google';

  return (
    <div className="settings-page">
      <SubpageHero
        eyebrow="Keep your account safe"
        title="Account & security"
        parent={{ to: '/profile', label: 'Profile' }}
      />

      <Section title="Sign-in" icon={LogIn} className="settings-group">
        <SettingsCard>
          <SettingsRow
            icon={AtSign}
            tone="ocean"
            title="Email"
            description={session?.user.email ?? '—'}
          />
          <SettingsRow
            icon={LogIn}
            tone="teal"
            title="Sign-in method"
            description={isGoogle ? 'Google account' : 'Email and password'}
          />
          <SettingsRow
            icon={MonitorSmartphone}
            tone="slate"
            title="Devices"
            description="Your data is available on every device you sign in on, online or offline."
          />
        </SettingsCard>
      </Section>

      <Section title="Password" icon={KeyRound} className="settings-group">
        <SettingsCard>
          <li className="settings-row settings-row--block">
            {isGoogle ? (
              <p className="settings-row__description">
                You sign in with Google, so your password is managed by your Google account.
              </p>
            ) : (
              <ChangePasswordForm />
            )}
          </li>
        </SettingsCard>
      </Section>
    </div>
  );
}

type Field = 'current' | 'next' | 'confirm';

function ChangePasswordForm() {
  const notify = useContext(ToastContext);
  const [values, setValues] = useState<Record<Field, string>>({
    current: '',
    next: '',
    confirm: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string | undefined>>>({});
  const [pending, setPending] = useState(false);

  const set = (field: Field) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
  };

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    const next: Partial<Record<Field, string | undefined>> = {
      current: values.current === '' ? 'Enter your current password.' : undefined,
      next:
        newPasswordError(values.next) ??
        (values.next === values.current ? 'Choose a password you haven’t used here.' : undefined),
      confirm: confirmPasswordError(values.next, values.confirm),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setPending(true);
    try {
      await changePassword(values.current, values.next);
      notify({ kind: 'success', message: 'Password updated' });
      setValues({ current: '', next: '', confirm: '' });
    } catch (error) {
      notify({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Couldn’t update your password.',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <PasswordField
        label="Current password"
        autoComplete="current-password"
        value={values.current}
        error={errors.current}
        onChange={set('current')}
      />
      <PasswordField
        label="New password"
        autoComplete="new-password"
        value={values.next}
        error={errors.next}
        onChange={set('next')}
      >
        <PasswordRules password={values.next} />
      </PasswordField>
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        value={values.confirm}
        error={errors.confirm}
        onChange={set('confirm')}
      />
      <div className="form__actions">
        <button type="submit" className="button button--primary settings-save" disabled={pending}>
          {pending ? (
            <>
              <Spinner /> Updating…
            </>
          ) : (
            'Update password'
          )}
        </button>
      </div>
    </form>
  );
}
