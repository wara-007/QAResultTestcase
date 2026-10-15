import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsGoogleAuthorization, googleAuthorizationTarget, googleAuthorizationReturn } from './google-authorization';

test('requests consent for missing connection and insufficient scope, not file permissions', () => {
  assert.equal(needsGoogleAuthorization(new Error('Request had insufficient authentication scopes.')), true);
  assert.equal(needsGoogleAuthorization({ response: { data: { error: { details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } } } }), true);
  assert.equal(needsGoogleAuthorization({ name: 'GoogleConnectionRequiredError' }), true);
  assert.equal(needsGoogleAuthorization(new Error('The caller does not have permission')), false);
  assert.equal(needsGoogleAuthorization(new Error('File not found')), false);
});
test('returns consent to the original route and stops repeated automatic consent', () => {
  const target = googleAuthorizationTarget('/api/google/auth/start?returnTo=/groups', 'http://localhost:3002', '/groups/g/projects?year=2026#list');
  assert.equal(new URL(target!, 'http://localhost:3002').searchParams.get('returnTo'), '/groups/g/projects?year=2026&googleAuthAttempt=1#list');
  assert.equal(googleAuthorizationTarget('/api/google/auth/start', 'http://localhost:3002', '/groups?googleAuthAttempt=1'), null);
  assert.equal(googleAuthorizationTarget('https://evil.example/auth', 'http://localhost:3002', '/groups'), null);
});
test('callback returns cancellation to the same route without losing query or hash', () => {
  assert.equal(googleAuthorizationReturn('/groups/g/projects?googleAuthAttempt=1#list', 'access_denied'), '/groups/g/projects?googleAuthAttempt=1&googleAuthError=access_denied#list');
  assert.equal(googleAuthorizationReturn('/groups/g/projects', undefined), '/groups/g/projects?googleAuth=connected');
});
