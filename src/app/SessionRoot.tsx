import { Navigate, Outlet } from 'react-router';
import { AUTH_ROUTES } from '@/features/auth/authRoutes';
import { SessionProvider } from '@/features/auth/SessionProvider';
import { useSession } from '@/features/auth/session-context';
import { ProfileProvider } from '@/features/profile/ProfileProvider';

/** The root of every route: the session, and the signed-in person's profile. */
export function SessionRoot() {
  return (
    <SessionProvider>
      <ProfileProvider>
        <Outlet />
      </ProfileProvider>
    </SessionProvider>
  );
}

/** Screens that need a signed-in session; anyone else goes to the welcome screen. */
export function RequireSession() {
  const { session } = useSession();
  if (!session) return <Navigate to={AUTH_ROUTES.welcome} replace />;
  return <Outlet />;
}

/** The welcome screen is only for signed-out visitors. */
export function SignedOutOnly() {
  const { session } = useSession();
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}
