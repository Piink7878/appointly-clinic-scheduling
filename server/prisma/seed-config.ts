// ==============================================================================
// Appointly — Seed configuration (passwords + demo-account gating)
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
// ==============================================================================

export const DEV_DEFAULT_PASSWORD = 'ChangeMe123!';

export interface SeedConfig {
  isProduction: boolean;
  adminPassword: string;
  seedDemoData: boolean;
  /** Present only when `seedDemoData` is true. */
  demoPassword: string | null;
}

export function resolveSeedConfig(env: NodeJS.ProcessEnv): SeedConfig {
  const isProduction = env.NODE_ENV === 'production';
  const demoRequested = (env.SEED_DEMO_DATA ?? '').trim().toLowerCase() === 'true';
  const seedDemoData = !isProduction || demoRequested;

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
      demoPassword = env.DEMO_USER_PASSWORD || env.SEED_DEFAULT_PASSWORD || '';
      if (!demoPassword) {
        throw new Error(
          'SEED_DEMO_DATA=true in production requires DEMO_USER_PASSWORD (or SEED_DEFAULT_PASSWORD); ' +
            'ADMIN_PASSWORD is never used for demo accounts.',
        );
      }
      if (demoPassword === adminPassword) {
        throw new Error('The demo account password must differ from ADMIN_PASSWORD in production.');
      }
    } else {
      demoPassword = env.DEMO_USER_PASSWORD || env.SEED_DEFAULT_PASSWORD || DEV_DEFAULT_PASSWORD;
    }
  }

  return { isProduction, adminPassword, seedDemoData, demoPassword };
}
