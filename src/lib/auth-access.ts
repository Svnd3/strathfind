import type { UserRole } from './types';

export type AuthPortal = UserRole;

export type PortalAccessResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Profile roles are security-sensitive and must come from the protected
 * database profile. Unknown values fail closed instead of becoming students.
 */
export function trustedProfileRole(value: unknown): UserRole {
  if (value === 'student' || value === 'admin') return value;
  throw new Error('The campus profile has an unsupported account role.');
}

/**
 * Picking a portal is routing intent, not a request to assign a role.
 * A successfully authenticated account may enter only its server-backed portal.
 */
export function authorizeSignInPortal(
  profileRole: UserRole,
  requestedPortal: AuthPortal,
): PortalAccessResult {
  if (profileRole === requestedPortal) return { ok: true };

  if (requestedPortal === 'admin') {
    return {
      ok: false,
      error: 'This account is not an administrator. Use Student sign in.',
    };
  }

  return {
    ok: false,
    error: 'Administrator accounts must use Admin sign in.',
  };
}
