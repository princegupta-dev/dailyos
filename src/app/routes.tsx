import type { RouteObject } from 'react-router';
import { LearnPage } from '@/features/learning/LearnPage';
import { ReviewPage } from '@/features/reviews/ReviewPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { NewTaskPage } from '@/features/tasks/NewTaskPage';
import { TaskDetailPage } from '@/features/tasks/TaskDetailPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { TodayPage } from '@/features/dashboard/TodayPage';
import { AppShell } from './AppShell';
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
      { path: 'review', element: <ReviewPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
