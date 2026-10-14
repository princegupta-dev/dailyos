import { ArrowLeft, Check, Eye, EyeOff, Sprout } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PASSWORD_RULES } from './credentials';

interface AuthScreenProps {
  title?: string | undefined;
  subtitle?: ReactNode;
  /** Where the back arrow leads; omitted on the first screen. */
  back?: { to: string; label: string } | undefined;
  /** Content above the title, e.g. a logo or status tile. */
  art?: ReactNode;
  /** Centers the title and art, for welcome and status screens. */
  centered?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * The frame for sign-in and setup screens: no tab bar, one focused column that becomes a
 * floating card on wider screens.
 */
export function AuthScreen({
  title,
  subtitle,
  back,
  art,
  centered = false,
  children,
  footer,
}: AuthScreenProps) {
  return (
    <div className="auth">
      <main id="main" className={`auth__card${centered ? ' auth__card--centered' : ''}`}>
        {back && (
          <Link to={back.to} className="auth__back icon-button" aria-label={back.label}>
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        )}
        {art}
        {title && (
          <header className="auth__header">
            <h1 className="auth__title">{title}</h1>
            {subtitle && <p className="auth__subtitle">{subtitle}</p>}
          </header>
        )}
        <div className="auth__body">{children}</div>
        {footer && <footer className="auth__footer">{footer}</footer>}
      </main>
    </div>
  );
}

/** The DailyOS mark: a sprout on the brand gradient. */
export function AppLogo({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`app-logo app-logo--${size}`} aria-hidden="true">
      <Sprout size={size === 'lg' ? 40 : 28} strokeWidth={2} />
    </span>
  );
}

/** Google's "G", as required on Google sign-in buttons. */
export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

/** A small inline spinner for buttons that are waiting. */
export function Spinner() {
  return <span className="auth-spinner" aria-hidden="true" />;
}

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  label: string;
  error?: string | undefined;
  /** Shown under the field, e.g. the password rules. */
  children?: ReactNode;
};

/** A password input with a show/hide toggle. */
export function PasswordField({ label, error, children, ...input }: PasswordFieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [visible, setVisible] = useState(false);
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="password-input">
        <input
          id={inputId}
          className="input"
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...input}
        />
        <button
          type="button"
          className="password-input__toggle"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => {
            setVisible((v) => !v);
          }}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
      {children}
    </div>
  );
}

/** Live checklist of the password requirements. */
export function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="password-rules" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className={`password-rules__item${met ? ' is-met' : ''}`}>
            <span className="password-rules__mark" aria-hidden="true">
              <Check size={12} strokeWidth={3} />
            </span>
            {rule.label}
            <span className="visually-hidden">{met ? ' (met)' : ' (not met yet)'}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Don't have an account? Create account" style line under a form. */
export function AuthSwitch({ prompt, to, label }: { prompt: string; to: string; label: string }) {
  return (
    <p className="auth-switch">
      {prompt} <Link to={to}>{label}</Link>
    </p>
  );
}
