import { Navigate, type RouteObject } from 'react-router';
import { HabitDetailPage } from '@/features/habits/HabitDetailPage';
import { NewHabitPage } from '@/features/habits/NewHabitPage';
import { HabitsPage } from '@/features/habits/HabitsPage';
import { InsightsPage } from '@/features/insights/InsightsPage';
import { LearnPage } from '@/features/learning/LearnPage';
import { LearningDetailPage } from '@/features/learning/LearningDetailPage';
import { NewLearningPage } from '@/features/learning/NewLearningPage';
import { ReviewPage } from '@/features/reviews/ReviewPage';
import { ReviewPeriodPage } from '@/features/reviews/ReviewPeriodPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { NewTaskPage } from '@/features/tasks/NewTaskPage';
import { TaskDetailPage } from '@/features/tasks/TaskDetailPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { TodayPage } from '@/features/dashboard/TodayPage';
import { AppShell } from './AppShell';
import { LegacyHabitRedirect } from './LegacyHabitRedirect';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'tasks/new', element: <NewTaskPage /> },
      { path: 'tasks/:taskId', element: <TaskDetailPage /> },
      { path: 'learn', element: <LearnPage /> },
      { path: 'learn/new', element: <NewLearningPage /> },
      { path: 'learn/:entryId', element: <LearningDetailPage /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'review/:periodType/:start', element: <ReviewPeriodPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'habits', element: <HabitsPage /> },
      { path: 'habits/new', element: <NewHabitPage /> },
      { path: 'habits/:habitId', element: <HabitDetailPage /> },
      { path: 'insights', element: <InsightsPage /> },
      // Habit screens used to live under Settings; keep old links working.
      { path: 'settings/habits/new', element: <Navigate to="/habits/new" replace /> },
      { path: 'settings/habits/:habitId', element: <LegacyHabitRedirect /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
