/**
 * Sign-in for DailyOS — a frontend-only stand-in.
 *
 * Every function here simulates what the real service will do (Google OAuth, email and
 * password) and resolves with a session after a short pause. Nothing is sent anywhere and no
 * password is kept. The UI only talks to these functions, so swapping in real calls later
 * won't touch the screens.
 *
 * The session is remembered in localStorage purely so a reload doesn't sign you out of the
 * demo. It holds no user data beyond a name and email; that data stays where it already is.
 */

export type AuthProvider = 'google' | 'email';

export interface AuthUser {
  name: string;
  email: string;
  provider: AuthProvider;
}

export interface Session {
  user: AuthUser;
  /** True for an account created just now, so the app can offer profile setup. */
  isNewAccount: boolean;
  /** Profile setup was completed (or skipped) and needn't be offered again. */
  profileSetupDone: boolean;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export const SESSION_STORAGE_KEY = 'dailyos.session';

/** The sample Google account the demo signs in with. */
const DEMO_GOOGLE_USER: AuthUser = {
  name: 'Anushka Gupta',
  email: 'anushka@gmail.com',
  provider: 'google',
};

const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 700;

function simulateRequest(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Real sign-in needs a connection; the demo behaves the same way.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      reject(new AuthError('You’re offline. Connect to the internet to sign in.'));
      return;
    }
    setTimeout(resolve, LATENCY_MS);
  });
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const words = local.split(/[._-]+/).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'DailyOS user';
}

/* ---------- Session persistence (demo only) ---------- */

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed.user?.email) return null;
    return {
      user: parsed.user,
      isNewAccount: parsed.isNewAccount ?? false,
      profileSetupDone: parsed.profileSetupDone ?? true,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage blocked (e.g. private mode): the session simply lasts until reload.
  }
}

/* ---------- Operations ---------- */

export async function signInWithEmail(email: string, password: string): Promise<Session> {
  await simulateRequest();
  if (password.length === 0) throw new AuthError('Enter your password.');
  return {
    user: { name: nameFromEmail(email), email: email.trim(), provider: 'email' },
    isNewAccount: false,
    profileSetupDone: true,
  };
}

export async function createAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<Session> {
  await simulateRequest();
  return {
    user: { name: input.name.trim(), email: input.email.trim(), provider: 'email' },
    isNewAccount: true,
    profileSetupDone: false,
  };
}

export async function signInWithGoogle(): Promise<Session> {
  await simulateRequest();
  // The real flow will tell us whether this Google account is new to DailyOS.
  return { user: DEMO_GOOGLE_USER, isNewAccount: true, profileSetupDone: false };
}

/** UI-only for now: password reset isn't available until the real service exists. */
export async function requestPasswordReset(_email: string): Promise<void> {
  await simulateRequest();
}

/** UI-only for now: accepts any current password. */
export async function changePassword(_current: string, _next: string): Promise<void> {
  await simulateRequest();
}

export async function signOut(): Promise<void> {
  // The real service will revoke tokens here. Local data on this device is left untouched.
  await Promise.resolve();
}
