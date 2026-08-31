import type { AuthPortal } from './auth-access';

export const OAUTH_CALLBACK_PATH = '/auth-callback';
export const OAUTH_INTENT_STORAGE_KEY = 'strathfind.oauth.intent.v1';
export const OAUTH_INTENT_TTL_MS = 10 * 60 * 1000;

const LOCAL_URL_BASE = 'https://strathfind.invalid';
const MAX_CLOCK_SKEW_MS = 60 * 1000;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;
const FORBIDDEN_RETURN_PATHS = [
  '/auth',
  OAUTH_CALLBACK_PATH,
  '/auth-onboarding',
] as const;

type MaybePromise<T> = T | Promise<T>;

export interface OAuthIntentStorage {
  getItem(key: string): MaybePromise<string | null>;
  setItem(key: string, value: string): MaybePromise<void>;
  removeItem(key: string): MaybePromise<void>;
}

export interface OAuthIntent {
  version: 1;
  portal: AuthPortal;
  returnTo: string | null;
  createdAt: number;
  expiresAt: number;
}

export type OAuthCallbackTarget =
  | { platform: 'web'; origin: string }
  | { platform: 'native'; scheme: string };

function decodeForValidation(value: string): string | null {
  let decoded = value;

  try {
    // A small bounded loop catches encoded backslashes, controls, and
    // protocol-relative paths without permitting unbounded decode work.
    for (let pass = 0; pass < 3; pass += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return null;
  }

  return decoded;
}

/** Returns a normalized in-app path, or null for unsafe/looping targets. */
export function sanitizeOAuthReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || CONTROL_CHARACTER_PATTERN.test(value)) return null;

  const decoded = decodeForValidation(value);
  if (
    !decoded
    || !decoded.startsWith('/')
    || decoded.startsWith('//')
    || decoded.includes('\\')
    || CONTROL_CHARACTER_PATTERN.test(decoded)
  ) return null;

  let parsed: URL;
  try {
    parsed = new URL(decoded, LOCAL_URL_BASE);
  } catch {
    return null;
  }

  if (parsed.origin !== LOCAL_URL_BASE) return null;
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const normalizedPathname = pathname.toLowerCase();
  if (FORBIDDEN_RETURN_PATHS.some((path) => (
    normalizedPathname === path || normalizedPathname.startsWith(`${path}/`)
  ))) return null;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function createOAuthIntent(
  portal: AuthPortal,
  returnTo?: unknown,
  now = Date.now(),
): OAuthIntent {
  if (portal !== 'student' && portal !== 'admin') {
    throw new Error('OAuth portal must be student or admin.');
  }
  if (!Number.isFinite(now)) throw new Error('OAuth intent time must be finite.');

  return {
    version: 1,
    portal,
    returnTo: sanitizeOAuthReturnTo(returnTo),
    createdAt: now,
    expiresAt: now + OAUTH_INTENT_TTL_MS,
  };
}

export function serializeOAuthIntent(intent: OAuthIntent): string {
  return JSON.stringify(intent);
}

/** Parses and revalidates untrusted persisted intent data. */
export function parseOAuthIntent(serialized: string | null | undefined, now = Date.now()): OAuthIntent | null {
  if (!serialized || !Number.isFinite(now)) return null;

  let candidate: unknown;
  try {
    candidate = JSON.parse(serialized);
  } catch {
    return null;
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const value = candidate as Partial<OAuthIntent>;
  if (value.version !== 1 || (value.portal !== 'student' && value.portal !== 'admin')) return null;
  if (!Number.isFinite(value.createdAt) || !Number.isFinite(value.expiresAt)) return null;

  const createdAt = value.createdAt as number;
  const expiresAt = value.expiresAt as number;
  if (
    expiresAt - createdAt !== OAUTH_INTENT_TTL_MS
    || createdAt > now + MAX_CLOCK_SKEW_MS
    || now >= expiresAt
  ) return null;

  const returnTo = value.returnTo === null ? null : sanitizeOAuthReturnTo(value.returnTo);
  if (value.returnTo !== null && returnTo === null) return null;

  return {
    version: 1,
    portal: value.portal,
    returnTo,
    createdAt,
    expiresAt,
  };
}

export async function persistOAuthIntent(
  storage: OAuthIntentStorage,
  portal: AuthPortal,
  returnTo?: unknown,
  now = Date.now(),
): Promise<OAuthIntent> {
  const intent = createOAuthIntent(portal, returnTo, now);
  await storage.setItem(OAUTH_INTENT_STORAGE_KEY, serializeOAuthIntent(intent));
  return intent;
}

/** Reads and removes the intent so a callback cannot replay navigation intent. */
export async function consumeOAuthIntent(
  storage: OAuthIntentStorage,
  now = Date.now(),
): Promise<OAuthIntent | null> {
  const serialized = await storage.getItem(OAUTH_INTENT_STORAGE_KEY);
  await storage.removeItem(OAUTH_INTENT_STORAGE_KEY);
  return parseOAuthIntent(serialized, now);
}

export function buildOAuthCallbackUrl(target: OAuthCallbackTarget): string {
  if (target.platform === 'web') {
    let origin: URL;
    try {
      origin = new URL(target.origin);
    } catch {
      throw new Error('OAuth web origin must be a valid URL.');
    }

    if (
      !['http:', 'https:'].includes(origin.protocol)
      || origin.username
      || origin.password
      || origin.pathname !== '/'
      || origin.search
      || origin.hash
    ) {
      throw new Error('OAuth web origin must be an HTTP(S) origin without a path, query, or credentials.');
    }

    return new URL(OAUTH_CALLBACK_PATH, origin.origin).toString();
  }

  const scheme = target.scheme.toLowerCase();
  if (!/^[a-z][a-z0-9+.-]*$/.test(scheme) || scheme === 'http' || scheme === 'https') {
    throw new Error('OAuth native scheme must be a valid custom URL scheme.');
  }

  return `${scheme}://${OAUTH_CALLBACK_PATH}`;
}
