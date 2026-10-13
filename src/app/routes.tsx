import { Navigate, type RouteObject } from 'react-router';
import { HabitDetailPage } from '@/features/habits/HabitDetailPage';
import { NewHabitPage } from '@/features/habits/NewHabitPage';
import { HabitsPage } from '@/features/habits/HabitsPage';
import { InsightsPage } from '@/features/insights/InsightsPage';
import { AccountsPage } from '@/features/investments/AccountsPage';
import { ActivityPage } from '@/features/investments/ActivityPage';
import { AnalysisPage } from '@/features/investments/AnalysisPage';
import { BudgetsPage } from '@/features/investments/BudgetsPage';
import { GoalsPage } from '@/features/investments/GoalsPage';
import { IncomePage } from '@/features/investments/IncomePage';
import { InvestmentsLayout } from '@/features/investments/InvestmentsLayout';
import { FinanceOverviewPage } from '@/features/investments/OverviewPage';
import { RecurringPage } from '@/features/investments/RecurringPage';
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
      {
        path: 'investments',
        element: <InvestmentsLayout />,
        children: [
          { index: true, element: <FinanceOverviewPage /> },
          { path: 'activity', element: <ActivityPage /> },
          { path: 'accounts', element: <AccountsPage /> },
          { path: 'recurring', element: <RecurringPage /> },
          // Portfolio became part of Accounts & assets; keep old links working.
          { path: 'portfolio', element: <Navigate to="/investments/accounts" replace /> },
          { path: 'budgets', element: <BudgetsPage /> },
          { path: 'goals', element: <GoalsPage /> },
          { path: 'income', element: <IncomePage /> },
          { path: 'analysis', element: <AnalysisPage /> },
        ],
      },
      // Habit screens used to live under Settings; keep old links working.
      { path: 'settings/habits/new', element: <Navigate to="/habits/new" replace /> },
      { path: 'settings/habits/:habitId', element: <LegacyHabitRedirect /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
