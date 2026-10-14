import {
  CircleCheckBig,
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { HabitTone } from '@/domain/appearance';
import { AppLogo, AuthLink, AuthPhoto } from './AuthUi';
import { AUTH_ROUTES } from './authRoutes';

const FEATURES: readonly { icon: LucideIcon; tone: HabitTone; title: string; note: string }[] = [
  { icon: CircleCheckBig, tone: 'ocean', title: 'Daily Commitments', note: 'Habits & routines' },
  { icon: LayoutDashboard, tone: 'indigo', title: 'Smart Dashboard', note: 'Your day at a glance' },
  { icon: Wallet, tone: 'amber', title: 'Money Management', note: 'Income & expenses' },
  { icon: TrendingUp, tone: 'sage', title: 'Personal Growth', note: 'Insights & reflection' },
];

/**
 * The first screen a signed-out visitor sees: what DailyOS is, what it brings together, and
 * the way in. The photo (AuthPhoto) is shared with every sign-in screen.
 */
export function WelcomePage() {
  return (
    <div className="auth auth--welcome">
      <main id="main" className="auth__card welcome">
        <AuthPhoto />
        <header className="welcome__intro">
          <span className="welcome__logo">
            <AppLogo size="md" />
          </span>
          <h1 className="welcome__brand">DailyOS</h1>
          <p className="welcome__tagline">
            Small steps, a <em>better you.</em>
          </p>
          <p className="welcome__description">
            Your personal operating system for habits, money, and growth — one calm place to plan
            your day and become who you want to be.
          </p>
        </header>

        <section className="welcome__showcase" aria-labelledby="welcome-features">
          <h2 id="welcome-features" className="visually-hidden">
            What DailyOS brings together
          </h2>
          <ul className="welcome__features">
            {FEATURES.map(({ icon: Icon, tone, title, note }) => (
              <li key={title} className={`feature-tile feature-tile--${tone}`}>
                <span className={`feature-tile__icon tone--${tone}`} aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="feature-tile__title">{title}</span>
                <span className="feature-tile__note">{note}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="welcome__actions">
          {/* Login offers both sign-in methods (Google or email) on the next screen. */}
          <AuthLink to={AUTH_ROUTES.login} className="button button--gradient button--block">
            Login
          </AuthLink>
          <AuthLink to={AUTH_ROUTES.createAccount} className="button button--outline button--block">
            Create Account
          </AuthLink>
          <p className="welcome__trust">
            <ShieldCheck size={14} aria-hidden="true" />
            Private by design · works online and offline
          </p>
        </footer>
      </main>
    </div>
  );
}
