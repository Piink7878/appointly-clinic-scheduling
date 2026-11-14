// ==============================================================================
// Appointly Server — UUID Validation
// ==============================================================================
// One strict check shared by every module. Identifiers are used verbatim as
// database keys, so surrounding whitespace is NOT tolerated: a padded id that
// passed a trimmed check would still be rejected by PostgreSQL and surface as 500.
// ==============================================================================

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True only for an RFC 4122 UUID string (versions 1–5), exactly as given. */
export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
