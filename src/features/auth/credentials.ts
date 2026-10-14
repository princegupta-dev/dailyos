/** Frontend checks for sign-in and sign-up forms. The real service will validate again. */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailError(email: string): string | undefined {
  if (email.trim() === '') return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email, like you@example.com.';
  return undefined;
}

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  {
    id: 'mix',
    label: 'One letter and one number',
    test: (p: string) => /[A-Za-z]/.test(p) && /\d/.test(p),
  },
  {
    id: 'special',
    label: 'One special character (e.g. !@#)',
    test: (p: string) => /[^A-Za-z0-9\s]/.test(p),
  },
] as const;

export function newPasswordError(password: string): string | undefined {
  if (password === '') return 'Create a password.';
  if (PASSWORD_RULES.some((rule) => !rule.test(password))) {
    return 'Your password doesn’t meet all the requirements below.';
  }
  return undefined;
}

export function confirmPasswordError(password: string, confirm: string): string | undefined {
  if (confirm === '') return 'Confirm your password.';
  if (confirm !== password) return 'Passwords don’t match.';
  return undefined;
}
