import { describe, expect, it } from 'vitest';

import { normalizeKenyanMobile } from './phone-number';

describe('Kenyan mobile number normalization', () => {
  it.each([
    ['0712345678', '+254712345678'],
    ['0112345678', '+254112345678'],
    ['+254712345678', '+254712345678'],
    ['+254112345678', '+254112345678'],
    [' 0712 345 678 ', '+254712345678'],
    ['(0112) 345-678', '+254112345678'],
    ['00254 712 345 678', '+254712345678'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeKenyanMobile(input)).toBe(expected);
  });

  it.each([
    '',
    '712345678',
    '254712345678',
    '0612345678',
    '071234567',
    '07123456789',
    '+254612345678',
    '+25471234abcd',
  ])('rejects unsupported value %s', (input) => {
    expect(normalizeKenyanMobile(input)).toBeNull();
  });
});
