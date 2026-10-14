import { Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { AppLogo, AuthScreen, GoogleMark } from './AuthUi';

/** The first screen a signed-out visitor sees. */
export function WelcomePage() {
  return (
    <AuthScreen
      centered
      art={<AppLogo />}
      footer={
        <p className="auth-note">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>
            Your data stays private and is available on all your devices, <em>online or off</em>.
          </span>
        </p>
      }
    >
      <div className="welcome">
        <h1 className="welcome__brand">DailyOS</h1>
        <p className="welcome__tagline">Small steps, a better you.</p>
        <p className="welcome__intro">
          Track your habits, manage your money and grow into the best version of yourself — all in
          one place.
        </p>
      </div>
      <div className="auth-actions">
        <Link to="/auth/google" className="button button--google button--block">
          <GoogleMark /> Continue with Google
        </Link>
        <p className="auth-divider">
          <span>or</span>
        </p>
        <Link to="/auth/sign-in" className="button button--secondary button--block">
          <Mail size={18} aria-hidden="true" /> Continue with Email
        </Link>
      </div>
      <p className="auth-switch">
        New to DailyOS? <Link to="/auth/create-account">Create an account</Link>
      </p>
    </AuthScreen>
  );
}
