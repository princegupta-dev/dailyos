import { createBrowserRouter, RouterProvider } from 'react-router';
import { ToastProvider } from '@/components/ToastProvider';
import { DatabaseGate } from './DatabaseGate';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <DatabaseGate>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </DatabaseGate>
  );
}
