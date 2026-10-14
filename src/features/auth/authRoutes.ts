/** Every sign-in screen's path, in one place so links and redirects can't drift apart. */
export const AUTH_ROUTES = {
  welcome: '/welcome',
  login: '/login',
  signIn: '/login/sign-in',
  google: '/login/google',
  forgotPassword: '/login/forgot-password',
  success: '/login/success',
  createAccount: '/create-account',
} as const;

/** Where the old `/auth/...` paths now live; kept as redirects so old links still work. */
export const LEGACY_AUTH_REDIRECTS: readonly (readonly [string, string])[] = [
  ['auth', AUTH_ROUTES.login],
  ['auth/sign-in', AUTH_ROUTES.signIn],
  ['auth/google', AUTH_ROUTES.google],
  ['auth/forgot-password', AUTH_ROUTES.forgotPassword],
  ['auth/success', AUTH_ROUTES.success],
  ['auth/create-account', AUTH_ROUTES.createAccount],
];
