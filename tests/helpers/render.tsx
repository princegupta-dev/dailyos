import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';
import { ToastProvider } from '@/components/ToastProvider';
import { saveSession, type Session } from '@/services/auth.service';

/** A returning email user who has finished profile setup. */
export const TEST_SESSION: Session = {
  user: { name: 'Test User', email: 'test@example.com', provider: 'email' },
  isNewAccount: false,
  profileSetupDone: true,
};

/**
 * Renders the full app (routes + providers) at `path`, backed by the fake IndexedDB.
 * Signed in by default; pass `{ session: null }` to start signed out.
 */
export function renderApp(
  path = '/',
  { session = TEST_SESSION }: { session?: Session | null } = {},
) {
  saveSession(session);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return { router, ...result };
}
