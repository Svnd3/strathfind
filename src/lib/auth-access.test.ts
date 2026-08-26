import { describe, expect, it } from 'vitest';

import { authorizeSignInPortal, trustedProfileRole } from './auth-access';

describe('authentication portal boundaries', () => {
  it('accepts only known roles from the trusted profile', () => {
    expect(trustedProfileRole('student')).toBe('student');
    expect(trustedProfileRole('admin')).toBe('admin');
    expect(() => trustedProfileRole('owner')).toThrow(/unsupported account role/i);
    expect(() => trustedProfileRole(undefined)).toThrow(/unsupported account role/i);
  });

  it('allows students only through the student portal', () => {
    expect(authorizeSignInPortal('student', 'student')).toEqual({ ok: true });
    expect(authorizeSignInPortal('student', 'admin')).toEqual({
      ok: false,
      error: 'This account is not an administrator. Use Student sign in.',
    });
  });

  it('allows administrators only through the admin portal', () => {
    expect(authorizeSignInPortal('admin', 'admin')).toEqual({ ok: true });
    expect(authorizeSignInPortal('admin', 'student')).toEqual({
      ok: false,
      error: 'Administrator accounts must use Admin sign in.',
    });
  });
});
