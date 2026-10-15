/** Missing OAuth scopes are not the same as a file-level access denial. */
export function needsGoogleAuthorization(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;
  const error = reason as { name?: string; message?: string; response?: { data?: { error?: { message?: string; details?: { reason?: string }[] } } } };
  const apiError = error.response?.data?.error;
  return error.name === 'GoogleConnectionRequiredError'
    || /insufficient authentication scopes/i.test(error.message ?? apiError?.message ?? '')
    || Boolean(apiError?.details?.some(detail => detail.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'));
}

export function googleAuthorizationTarget(authUrl: string, origin: string, returnTo: string): string | null {
  const target = new URL(authUrl, origin);
  const current = new URL(returnTo, origin);
  if (target.origin !== origin || target.pathname !== '/api/google/auth/start' || current.origin !== origin) return null;
  if (current.searchParams.has('googleAuthAttempt') || current.searchParams.has('googleAuthError')) return null;
  current.searchParams.set('googleAuthAttempt', '1');
  target.searchParams.set('returnTo', `${current.pathname}${current.search}${current.hash}`);
  return target.toString();
}

export function googleAuthorizationReturn(returnTo: string, error?: string): string {
  const url = new URL(returnTo, 'http://local');
  url.searchParams.delete('googleAuth');
  url.searchParams.delete('googleAuthError');
  url.searchParams.set(error ? 'googleAuthError' : 'googleAuth', error ?? 'connected');
  return `${url.pathname}${url.search}${url.hash}`;
}
