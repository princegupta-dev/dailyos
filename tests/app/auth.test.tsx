import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { getSettings } from '@/db/repositories/settings';
import { loadSession } from '@/services/auth.service';
import { resetDatabase } from '../helpers/db';
import { renderApp } from '../helpers/render';

beforeEach(async () => {
  await resetDatabase(Intl.DateTimeFormat().resolvedOptions().timeZone);
});

const signedOut = { session: null };

describe('signing in', () => {
  it('sends signed-out visitors to the welcome screen', async () => {
    const { router } = renderApp('/habits', signedOut);
    expect(await screen.findByRole('heading', { level: 1, name: 'DailyOS' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/welcome');
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create Account' })).toHaveAttribute(
      'href',
      '/create-account',
    );
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('offers exactly Google and email on the method screen', () => {
    renderApp('/login', signedOut);
    const options = screen.getAllByRole('link', { name: /^Continue with/ });
    expect(options.map((o) => o.getAttribute('href'))).toEqual(['/login/google', '/login/sign-in']);
  });

  it('validates the email sign-in form, toggles the password, and signs in', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/login/sign-in', signedOut);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'secret-1!');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText(/Enter a valid email/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'priya.sharma@example.com');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome back, Priya!' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login/success');
    expect(loadSession()?.user.email).toBe('priya.sharma@example.com');

    await user.click(screen.getByRole('link', { name: 'Go to dashboard' }));
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('keeps forgot password UI-only', async () => {
    const user = userEvent.setup();
    renderApp('/login/sign-in', signedOut);
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));
    await user.type(await screen.findByLabelText('Email'), 'me@example.com');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(
      await screen.findByRole('heading', { name: 'Password reset is coming soon' }),
    ).toBeInTheDocument();
  });

  it('checks the new password rules when creating an account', async () => {
    const user = userEvent.setup();
    renderApp('/create-account', signedOut);

    await user.type(screen.getByLabelText('Name'), 'Ravi Kumar');
    await user.type(screen.getByLabelText('Email'), 'ravi@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    const rules = screen.getByRole('list', { name: 'Password requirements' });
    expect(within(rules).getByText(/At least 8 characters/)).toHaveTextContent('not met');

    await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText(/doesn’t meet all the requirements/)).toBeInTheDocument();
    expect(screen.getByText('Passwords don’t match.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'Daily0s!');
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'Daily0s!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'You’re in!' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue to profile setup' })).toHaveAttribute(
      'href',
      '/onboarding',
    );
  });

  it('signs in with Google through the simulated flow', async () => {
    const user = userEvent.setup();
    renderApp('/login/google', signedOut);
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'You’re in!' }),
    ).toBeInTheDocument();
    expect(loadSession()?.user.provider).toBe('google');
  });
});

describe('sign-in navigation', () => {
  it('links Login and Create account to each other, and both back arrows lead to Welcome', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/welcome', signedOut);

    await user.click(screen.getByRole('link', { name: 'Login' }));
    await screen.findByRole('heading', { level: 1, name: 'How would you like to continue?' });
    expect(router.state.location.pathname).toBe('/login');

    await user.click(screen.getByRole('link', { name: 'Create account' }));
    await screen.findByRole('heading', { level: 1, name: 'Create your account' });
    expect(router.state.location.pathname).toBe('/create-account');

    await user.click(screen.getByRole('link', { name: 'Login' }));
    await screen.findByRole('heading', { level: 1, name: 'How would you like to continue?' });

    await user.click(screen.getByRole('link', { name: 'Back to welcome' }));
    await screen.findByRole('heading', { level: 1, name: 'DailyOS' });
    expect(router.state.location.pathname).toBe('/welcome');

    // The arrow stepped back through history, so browser back doesn't return to Login.
    expect(router.state.historyAction).toBe('POP');
  });

  it('sends the Create account back arrow to Welcome even when opened directly', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/create-account', signedOut);
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    await user.click(screen.getByRole('link', { name: 'Back to welcome' }));
    await screen.findByRole('heading', { level: 1, name: 'DailyOS' });
    expect(router.state.location.pathname).toBe('/welcome');
  });

  it('steps back from a sign-in subroute to Login', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/login', signedOut);
    await user.click(screen.getByRole('link', { name: /Continue with Email/ }));
    await screen.findByRole('heading', { level: 1, name: 'Welcome back' });
    expect(router.state.location.pathname).toBe('/login/sign-in');
    await user.click(screen.getByRole('link', { name: 'Back to login' }));
    await screen.findByRole('heading', { level: 1, name: 'How would you like to continue?' });
    expect(router.state.historyAction).toBe('POP');
  });

  it.each([
    ['/auth', '/login'],
    ['/auth/sign-in', '/login/sign-in'],
    ['/auth/google', '/login/google'],
    ['/auth/forgot-password', '/login/forgot-password'],
    ['/auth/create-account', '/create-account'],
  ])('redirects the old path %s to %s', async (from, to) => {
    const { router } = renderApp(from, signedOut);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(to);
    });
  });
});

describe('profile setup', () => {
  it('walks through five steps, validates, reviews, edits, and completes', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/onboarding', {
      session: {
        user: { name: 'Meera Iyer', email: 'meera@example.com', provider: 'email' },
        isNewAccount: true,
        profileSetupDone: false,
      },
    });

    // Step 1: name comes from the account; date of birth and country are required.
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveValue('Meera');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter your date of birth.')).toBeInTheDocument();
    expect(screen.getByText('Choose your country.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Date of birth'), '1998-03-12');
    await user.selectOptions(screen.getByLabelText('Country'), 'India');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: optional, but numbers must be sensible.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Health & wellness' }),
    ).toHaveFocus();
    await user.type(screen.getByLabelText('Height'), '999');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/Enter a height between/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Height'));
    await user.type(screen.getByLabelText('Height'), '165');
    await user.click(screen.getByRole('button', { name: 'Add suggested tag Peanuts' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3: occupation is required.
    await screen.findByRole('heading', { level: 1, name: 'Professional information' });
    await user.type(screen.getByLabelText('Occupation'), 'Designer');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 4: exercise days and activities.
    await screen.findByRole('heading', { level: 1, name: 'Lifestyle & preferences' });
    await user.click(screen.getByRole('checkbox', { name: 'Monday' }));
    await user.click(screen.getByRole('button', { name: 'Add suggested tag Yoga' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 5: review shows what was entered, and each section can be edited.
    await screen.findByRole('heading', { level: 1, name: 'Review your information' });
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    expect(screen.getByText(/Designer/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Professional information' }));
    await user.type(screen.getByLabelText('Company (optional)'), 'Studio Nine');
    await user.click(screen.getByRole('button', { name: 'Save and review' }));
    expect(await screen.findByText(/Designer, Studio Nine/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Complete setup' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(loadSession()?.profileSetupDone).toBe(true);
  });
});

describe('profile and logout', () => {
  it('shows the profile with completion, and saves an edited section', async () => {
    const user = userEvent.setup();
    renderApp('/profile');
    expect(screen.getByRole('heading', { level: 2, name: 'Anushka Gupta' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Profile completion' })).toHaveAttribute(
      'aria-valuenow',
    );

    await user.click(screen.getByRole('link', { name: /^Professional information/ }));
    const occupation = await screen.findByLabelText('Occupation');
    expect(occupation).toHaveValue('Software Developer');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await user.clear(occupation);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Enter your occupation.')).toBeInTheDocument();

    await user.type(occupation, 'Product Manager');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByRole('link', { name: /^Professional information.*Product Manager/ }),
    ).toBeInTheDocument();
  });

  it('confirms before logging out, then returns to the welcome screen', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/profile');

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    const dialog = screen.getByRole('dialog', { name: 'Log out?' });
    expect(dialog).toHaveTextContent('Are you sure you want to log out of DailyOS?');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(loadSession()).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Log out?' })).getByRole('button', {
        name: 'Log out',
      }),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'DailyOS' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/welcome');
    expect(loadSession()).toBeNull();

    // Signed out, the app's screens send you back to the welcome screen.
    await router.navigate('/habits');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/welcome');
    });
  });

  it('keeps the Dashboard greeting name under App preferences', async () => {
    const user = userEvent.setup();
    renderApp('/profile/preferences');
    await user.type(await screen.findByLabelText('Your name'), 'Sam');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => {
      expect((await getSettings()).displayName).toBe('Sam');
    });
  });
});
