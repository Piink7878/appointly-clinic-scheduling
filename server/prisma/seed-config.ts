// ==============================================================================
// Appointly — Seed configuration (passwords, demo gating, overwrite policy)
// ==============================================================================
// Kept free of Prisma/argon2 imports so it can be unit-tested without a database.
//
// Rules:
//   * The Administrator account is ALWAYS seeded. In production its password
//     comes ONLY from ADMIN_PASSWORD (Secret Manager) and is required.
//   * Demo/test accounts (doctors, patients, inactive user) are seeded only when
//       - NODE_ENV !== 'production'  (local dev / CI), or
//       - SEED_DEMO_DATA=true        (explicit opt-in, e.g. `deploy.sh --demo`).
//   * Demo accounts NEVER use ADMIN_PASSWORD. In production they require their
//     own DEMO_USER_PASSWORD; otherwise the seed fails instead of falling back.
//     (SEED_DEFAULT_PASSWORD is a dev/CI convenience and is ignored in production.)
//   * Production is create-if-missing for the Admin account, Clinic Settings and
//     Medical Services: existing rows are never overwritten, so changes made by
//     administrators survive every release. Dev/CI keep resetting them to the
//     seed defaults so tests start from a known state.
//   * The only exception is an explicit admin password rotation:
//     ADMIN_PASSWORD_RESET=true (production only, default off). It updates the
//     password hash and NOTHING else (role and account status are untouched).
//     The deploy tooling passes it per Cloud Run job execution, never stores it.
// ==============================================================================

export const DEV_DEFAULT_PASSWORD = 'ChangeMe123!';
export const DEFAULT_ADMIN_EMAIL = 'admin@appointly.local';

export interface SeedConfig {
  isProduction: boolean;
  adminEmail: string;
  adminPassword: string;
  seedDemoData: boolean;
  /** Present only when `seedDemoData` is true. */
  demoPassword: string | null;
  /** True in production: existing Admin / Clinic Settings / Services are never overwritten. */
  preserveExisting: boolean;
  /** True only in production with ADMIN_PASSWORD_RESET=true: rotate the admin password hash. */
  resetAdminPassword: boolean;
}

const isTrue = (value: string | undefined): boolean => (value ?? '').trim().toLowerCase() === 'true';

export function resolveSeedConfig(env: NodeJS.ProcessEnv): SeedConfig {
  const isProduction = env.NODE_ENV === 'production';
  const seedDemoData = !isProduction || isTrue(env.SEED_DEMO_DATA);
  const adminEmail = (env.SEED_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();

  // Administrator password.
  // Production: ADMIN_PASSWORD only (never SEED_DEFAULT_PASSWORD / dev default).
  // Non-production: keep the shared dev/CI password so existing tests still log in.
  let adminPassword: string;
  if (isProduction) {
    adminPassword = env.ADMIN_PASSWORD ?? '';
    if (!adminPassword) {
      throw new Error('ADMIN_PASSWORD must be set in production.');
    }
  } else {
    adminPassword = env.SEED_DEFAULT_PASSWORD || env.ADMIN_PASSWORD || DEV_DEFAULT_PASSWORD;
  }

  // Demo/test account password. Deliberately never falls back to ADMIN_PASSWORD.
  let demoPassword: string | null = null;
  if (seedDemoData) {
    if (isProduction) {
      demoPassword = env.DEMO_USER_PASSWORD || '';
      if (!demoPassword) {
        throw new Error(
          'SEED_DEMO_DATA=true in production requires DEMO_USER_PASSWORD; ' +
            'ADMIN_PASSWORD and SEED_DEFAULT_PASSWORD are never used for demo accounts in production.',
        );
      }
      if (demoPassword === adminPassword) {
        throw new Error('The demo account password must differ from ADMIN_PASSWORD in production.');
      }
    } else {
      demoPassword = env.DEMO_USER_PASSWORD || env.SEED_DEFAULT_PASSWORD || DEV_DEFAULT_PASSWORD;
    }
  }

  return {
    isProduction,
    adminEmail,
    adminPassword,
    seedDemoData,
    demoPassword,
    preserveExisting: isProduction,
    // Only honoured in production, and only for the exact value "true".
    resetAdminPassword: isProduction && isTrue(env.ADMIN_PASSWORD_RESET),
  };
}

/**
 * Fields the seed may change on an EXISTING admin user.
 *  - dev/CI    : full reset to the seed defaults.
 *  - production: nothing, unless a password rotation was requested; then the
 *                password hash only (never role or account status).
 */
export function adminUpdateData(
  config: Pick<SeedConfig, 'preserveExisting' | 'resetAdminPassword'>,
  passwordHash: string,
): { passwordHash?: string; role?: 'ADMIN'; accountStatus?: 'ACTIVE' } {
  if (!config.preserveExisting) {
    return { passwordHash, role: 'ADMIN', accountStatus: 'ACTIVE' };
  }
  return config.resetAdminPassword ? { passwordHash } : {};
}

/** Returns `data` when seed defaults may overwrite existing rows, else `{}` (create-if-missing). */
export function overwriteData<T extends object>(
  config: Pick<SeedConfig, 'preserveExisting'>,
  data: T,
): T | Record<string, never> {
  return config.preserveExisting ? {} : data;
}
