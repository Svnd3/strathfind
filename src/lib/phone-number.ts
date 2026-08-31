/**
 * Accepts common Kenyan mobile formats and returns the E.164 value stored by
 * the backend. Local 01/07 prefixes are intentionally supported at input.
 */
export function normalizeKenyanMobile(value: string): string | null {
  let compact = value.trim().replace(/[\s().-]/g, '');
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;

  if (/^0[17]\d{8}$/.test(compact)) {
    compact = `+254${compact.slice(1)}`;
  }

  return /^\+254[17]\d{8}$/.test(compact) ? compact : null;
}
