import type { RouteObject } from 'react-router';
import { HabitDetailPage } from '@/features/habits/HabitDetailPage';
import { NewHabitPage } from '@/features/habits/NewHabitPage';
import { LearnPage } from '@/features/learning/LearnPage';
import { LearningDetailPage } from '@/features/learning/LearningDetailPage';
import { NewLearningPage } from '@/features/learning/NewLearningPage';
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
      { path: 'learn/new', element: <NewLearningPage /> },
      { path: 'learn/:entryId', element: <LearningDetailPage /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/habits/new', element: <NewHabitPage /> },
      { path: 'settings/habits/:habitId', element: <HabitDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
