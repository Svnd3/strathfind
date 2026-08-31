import { describe, expect, it } from 'vitest';

import {
  buildOAuthCallbackUrl,
  consumeOAuthIntent,
  createOAuthIntent,
  OAUTH_INTENT_STORAGE_KEY,
  OAUTH_INTENT_TTL_MS,
  parseOAuthIntent,
  persistOAuthIntent,
  sanitizeOAuthReturnTo,
  serializeOAuthIntent,
  type OAuthIntentStorage,
} from './oauth-navigation';

function memoryStorage(): OAuthIntentStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe('OAuth return navigation', () => {
  it('normalizes safe local destinations', () => {
    expect(sanitizeOAuthReturnTo('/item/123?claim=1#details')).toBe('/item/123?claim=1#details');
    expect(sanitizeOAuthReturnTo('/activity/../account')).toBe('/account');
  });

  it.each([
    undefined,
    '',
    'https://evil.example',
    '//evil.example/path',
    '/\\evil.example',
    '/%5c%5cevil.example',
    '/%25255c%25255cevil.example',
    '/item/\u0000secret',
    '/item/%00secret',
    '/auth',
    '/auth/',
    '/auth?mode=sign-in',
    '/auth-callback#again',
    '/auth-onboarding/next',
    '/safe/../auth-callback',
  ])('rejects unsafe or looping destination %s', (value) => {
    expect(sanitizeOAuthReturnTo(value)).toBeNull();
  });
});

describe('OAuth intent persistence', () => {
  const now = Date.UTC(2026, 7, 26, 10, 0, 0);

  it('round-trips a valid intent within the ten-minute lifetime', () => {
    const intent = createOAuthIntent('student', '/item/123', now);
    expect(intent.expiresAt - intent.createdAt).toBe(OAUTH_INTENT_TTL_MS);
    expect(parseOAuthIntent(serializeOAuthIntent(intent), now + OAUTH_INTENT_TTL_MS - 1)).toEqual(intent);
  });

  it('rejects expired, malformed, tampered, and far-future intents', () => {
    const intent = createOAuthIntent('admin', '/admin', now);
    expect(intent.returnTo).toBe('/admin');
    expect(parseOAuthIntent(serializeOAuthIntent(intent), intent.expiresAt)).toBeNull();
    expect(parseOAuthIntent('{not-json', now)).toBeNull();
    expect(parseOAuthIntent(JSON.stringify({ ...intent, portal: 'owner' }), now)).toBeNull();
    expect(parseOAuthIntent(JSON.stringify({ ...intent, expiresAt: intent.expiresAt + 1 }), now)).toBeNull();
    expect(parseOAuthIntent(serializeOAuthIntent(intent), now - 60_001)).toBeNull();
  });

  it('persists and consumes an intent exactly once', async () => {
    const storage = memoryStorage();
    const saved = await persistOAuthIntent(storage, 'student', '/account', now);

    expect(storage.values.has(OAUTH_INTENT_STORAGE_KEY)).toBe(true);
    await expect(consumeOAuthIntent(storage, now + 1)).resolves.toEqual(saved);
    expect(storage.values.has(OAUTH_INTENT_STORAGE_KEY)).toBe(false);
    await expect(consumeOAuthIntent(storage, now + 2)).resolves.toBeNull();
  });

  it('removes invalid persisted data when consumed', async () => {
    const storage = memoryStorage();
    storage.values.set(OAUTH_INTENT_STORAGE_KEY, '{invalid');

    await expect(consumeOAuthIntent(storage, now)).resolves.toBeNull();
    expect(storage.values.has(OAUTH_INTENT_STORAGE_KEY)).toBe(false);
  });
});

describe('OAuth callback URLs', () => {
  it('builds a callback from a secure web origin', () => {
    expect(buildOAuthCallbackUrl({ platform: 'web', origin: 'https://find.example.edu' }))
      .toBe('https://find.example.edu/auth-callback');
    expect(buildOAuthCallbackUrl({ platform: 'web', origin: 'http://localhost:8081' }))
      .toBe('http://localhost:8081/auth-callback');
  });

  it('builds a triple-slash callback for a native custom scheme', () => {
    expect(buildOAuthCallbackUrl({ platform: 'native', scheme: 'StrathFind' }))
      .toBe('strathfind:///auth-callback');
  });

  it('rejects malformed web origins and non-custom native schemes', () => {
    expect(() => buildOAuthCallbackUrl({ platform: 'web', origin: 'https://user@example.edu/app' })).toThrow();
    expect(() => buildOAuthCallbackUrl({ platform: 'native', scheme: 'https' })).toThrow();
    expect(() => buildOAuthCallbackUrl({ platform: 'native', scheme: 'bad scheme' })).toThrow();
  });
});
