import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';
import { ToastProvider } from '@/components/ToastProvider';

/** Renders the full app (routes + providers) at `path`, backed by the fake IndexedDB. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return { router, ...result };
}
