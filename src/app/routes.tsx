import { Navigate, type RouteObject } from 'react-router';
import { AuthSuccessPage } from '@/features/auth/AuthSuccessPage';
import { AUTH_ROUTES, LEGACY_AUTH_REDIRECTS } from '@/features/auth/authRoutes';
import { ChooseMethodPage } from '@/features/auth/ChooseMethodPage';
import { CreateAccountPage } from '@/features/auth/CreateAccountPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { GoogleSignInPage } from '@/features/auth/GoogleSignInPage';
import { SignInPage } from '@/features/auth/SignInPage';
import { WelcomePage } from '@/features/auth/WelcomePage';
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
import { ProfileSetupPage } from '@/features/onboarding/ProfileSetupPage';
import { FocusPage } from '@/features/planning/FocusPage';
import { AboutPage } from '@/features/profile/AboutPage';
import { AccountSecurityPage } from '@/features/profile/AccountSecurityPage';
import { DataPrivacyPage } from '@/features/profile/DataPrivacyPage';
import { HelpSupportPage } from '@/features/profile/HelpSupportPage';
import { PreferencesPage } from '@/features/profile/PreferencesPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { ProfileSectionPage } from '@/features/profile/ProfileSectionPage';
import { OpenActionsPage } from '@/features/reviews/OpenActionsPage';
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
import { RequireSession, SessionRoot, SignedOutOnly } from './SessionRoot';

export const routes: RouteObject[] = [
  {
    // Session and profile state for every screen. Sign-in is simulated on the frontend for
    // now (see services/auth.service.ts).
    element: <SessionRoot />,
    errorElement: <RouteError />,
    children: [
      {
        element: <SignedOutOnly />,
        children: [{ path: AUTH_ROUTES.welcome, element: <WelcomePage /> }],
      },
      { path: AUTH_ROUTES.login, element: <ChooseMethodPage /> },
      { path: AUTH_ROUTES.signIn, element: <SignInPage /> },
      { path: AUTH_ROUTES.google, element: <GoogleSignInPage /> },
      { path: AUTH_ROUTES.forgotPassword, element: <ForgotPasswordPage /> },
      { path: AUTH_ROUTES.createAccount, element: <CreateAccountPage /> },
      // Sign-in screens used to live under /auth; keep old links working.
      ...LEGACY_AUTH_REDIRECTS.map(([path, to]) => ({
        path,
        element: <Navigate to={to} replace />,
      })),
      {
        element: <RequireSession />,
        children: [
          { path: AUTH_ROUTES.success, element: <AuthSuccessPage /> },
          { path: 'onboarding', element: <ProfileSetupPage /> },
          {
            path: '/',
            element: <AppShell />,
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
              // Settings: the hub for insights, reviews, tasks, learnings, and focus. Those
              // screens keep their own top-level paths so existing links still work.
              { path: 'settings', element: <SettingsPage /> },
              { path: 'settings/actions', element: <OpenActionsPage /> },
              { path: 'settings/focus', element: <FocusPage /> },
              // Profile: who you are, app preferences, account, and data.
              { path: 'profile', element: <ProfilePage /> },
              { path: 'profile/personal', element: <ProfileSectionPage section="personal" /> },
              { path: 'profile/health', element: <ProfileSectionPage section="health" /> },
              {
                path: 'profile/professional',
                element: <ProfileSectionPage section="professional" />,
              },
              { path: 'profile/lifestyle', element: <ProfileSectionPage section="lifestyle" /> },
              { path: 'profile/preferences', element: <PreferencesPage /> },
              { path: 'profile/account', element: <AccountSecurityPage /> },
              { path: 'profile/help', element: <HelpSupportPage /> },
              { path: 'profile/data', element: <DataPrivacyPage /> },
              { path: 'profile/about', element: <AboutPage /> },
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
        ],
      },
    ],
  },
];
