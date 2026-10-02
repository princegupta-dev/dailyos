import { Outlet } from 'react-router';
import { BottomNav } from '@/components/BottomNav';

export function AppShell() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <main id="main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
