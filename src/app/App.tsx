import { createBrowserRouter, RouterProvider } from 'react-router';
import { ToastProvider } from '@/components/ToastProvider';
import { DatabaseGate } from './DatabaseGate';
import { routes } from './routes';

// Served under a sub-path on GitHub Pages (see vite.config.ts); '/' locally.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
const router = createBrowserRouter(routes, { basename });

export function App() {
  return (
    <DatabaseGate>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </DatabaseGate>
  );
}
