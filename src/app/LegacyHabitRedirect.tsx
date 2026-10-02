import { Navigate, useParams } from 'react-router';

/** Habit screens used to live under /settings/habits; keep old links working. */
export function LegacyHabitRedirect() {
  const { habitId = '' } = useParams();
  return <Navigate to={`/habits/${habitId}`} replace />;
}
