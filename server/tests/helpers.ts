// ==============================================================================
// Appointly Server — Shared Test Helpers
// ==============================================================================

/**
 * supertest types `res.headers['set-cookie']` as `string`, but Node delivers an
 * array. Normalises it so it can be passed straight to `.set('Cookie', …)`.
 */
export function cookiesOf(res: { headers: Record<string, unknown> }): string[] {
  const value = res.headers['set-cookie'];
  if (Array.isArray(value)) return value as string[];
  return typeof value === 'string' ? [value] : [];
}
