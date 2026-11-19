import { describe, it, expect } from 'vitest';
import { resolveSeedConfig, adminUpdateData, overwriteData } from '../../../prisma/seed-config';

const env = (vars: Record<string, string | undefined>) => vars as NodeJS.ProcessEnv;
const prod = { NODE_ENV: 'production', ADMIN_PASSWORD: 'prod-admin-pw' };

describe('resolveSeedConfig — overwrite policy and admin password rotation', () => {
  it('production preserves existing data; dev/CI does not', () => {
    expect(resolveSeedConfig(env(prod)).preserveExisting).toBe(true);
    expect(resolveSeedConfig(env({ NODE_ENV: 'test' })).preserveExisting).toBe(false);
    expect(resolveSeedConfig(env({})).preserveExisting).toBe(false);
  });

  it('ADMIN_PASSWORD_RESET defaults to false', () => {
    expect(resolveSeedConfig(env(prod)).resetAdminPassword).toBe(false);
  });

  it.each(['false', '', '1', 'yes', 'on'])('only the value "true" enables rotation (got %j)', (v) => {
    expect(resolveSeedConfig(env({ ...prod, ADMIN_PASSWORD_RESET: v })).resetAdminPassword).toBe(false);
  });

  it('ADMIN_PASSWORD_RESET=true enables rotation in production', () => {
    expect(resolveSeedConfig(env({ ...prod, ADMIN_PASSWORD_RESET: 'true' })).resetAdminPassword).toBe(true);
  });

  it('ADMIN_PASSWORD_RESET is ignored outside production', () => {
    expect(resolveSeedConfig(env({ NODE_ENV: 'test', ADMIN_PASSWORD_RESET: 'true' })).resetAdminPassword).toBe(false);
  });

  it('normalises SEED_ADMIN_EMAIL', () => {
    expect(resolveSeedConfig(env({ SEED_ADMIN_EMAIL: '  Boss@Appointly.local ' })).adminEmail).toBe('boss@appointly.local');
    expect(resolveSeedConfig(env({})).adminEmail).toBe('admin@appointly.local');
  });
});

describe('adminUpdateData / overwriteData', () => {
  it('production without rotation updates nothing on an existing admin', () => {
    expect(adminUpdateData({ preserveExisting: true, resetAdminPassword: false }, 'h')).toEqual({});
  });

  it('production rotation updates the password hash only (no role / status)', () => {
    const data = adminUpdateData({ preserveExisting: true, resetAdminPassword: true }, 'new-hash');
    expect(data).toEqual({ passwordHash: 'new-hash' });
    expect(data).not.toHaveProperty('role');
    expect(data).not.toHaveProperty('accountStatus');
  });

  it('dev/CI fully resets the admin', () => {
    expect(adminUpdateData({ preserveExisting: false, resetAdminPassword: false }, 'h')).toEqual({
      passwordHash: 'h',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
    });
  });

  it('overwriteData is empty in production and passthrough otherwise', () => {
    expect(overwriteData({ preserveExisting: true }, { a: 1 })).toEqual({});
    expect(overwriteData({ preserveExisting: false }, { a: 1 })).toEqual({ a: 1 });
  });
});
