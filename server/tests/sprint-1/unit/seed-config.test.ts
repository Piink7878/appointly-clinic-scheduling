import { describe, it, expect } from 'vitest';
import { resolveSeedConfig, DEV_DEFAULT_PASSWORD } from '../../../prisma/seed-config';

const env = (vars: Record<string, string | undefined>) => vars as NodeJS.ProcessEnv;

describe('resolveSeedConfig — production admin vs demo accounts', () => {
  it('production without SEED_DEMO_DATA seeds admin only, using ADMIN_PASSWORD', () => {
    const cfg = resolveSeedConfig(env({ NODE_ENV: 'production', ADMIN_PASSWORD: 'prod-admin-pw' }));
    expect(cfg.adminPassword).toBe('prod-admin-pw');
    expect(cfg.seedDemoData).toBe(false);
    expect(cfg.demoPassword).toBeNull();
  });

  it('production never falls back to SEED_DEFAULT_PASSWORD for the admin', () => {
    expect(() =>
      resolveSeedConfig(env({ NODE_ENV: 'production', SEED_DEFAULT_PASSWORD: 'shared' })),
    ).toThrow(/ADMIN_PASSWORD must be set/);
  });

  it('production requires ADMIN_PASSWORD', () => {
    expect(() => resolveSeedConfig(env({ NODE_ENV: 'production' }))).toThrow(/ADMIN_PASSWORD/);
  });

  it('production with SEED_DEMO_DATA=true uses DEMO_USER_PASSWORD, not ADMIN_PASSWORD', () => {
    const cfg = resolveSeedConfig(
      env({
        NODE_ENV: 'production',
        ADMIN_PASSWORD: 'prod-admin-pw',
        SEED_DEMO_DATA: 'true',
        DEMO_USER_PASSWORD: 'demo-pw',
      }),
    );
    expect(cfg.seedDemoData).toBe(true);
    expect(cfg.demoPassword).toBe('demo-pw');
    expect(cfg.adminPassword).toBe('prod-admin-pw');
  });

  it('production with SEED_DEMO_DATA=true but no demo password fails instead of reusing ADMIN_PASSWORD', () => {
    expect(() =>
      resolveSeedConfig(
        env({ NODE_ENV: 'production', ADMIN_PASSWORD: 'prod-admin-pw', SEED_DEMO_DATA: 'true' }),
      ),
    ).toThrow(/DEMO_USER_PASSWORD/);
  });

  it('production does not fall back to SEED_DEFAULT_PASSWORD for demo accounts', () => {
    expect(() =>
      resolveSeedConfig(
        env({
          NODE_ENV: 'production',
          ADMIN_PASSWORD: 'prod-admin-pw',
          SEED_DEMO_DATA: 'true',
          SEED_DEFAULT_PASSWORD: 'shared',
        }),
      ),
    ).toThrow(/DEMO_USER_PASSWORD/);
  });

  it('production rejects a demo password identical to the admin password', () => {
    expect(() =>
      resolveSeedConfig(
        env({
          NODE_ENV: 'production',
          ADMIN_PASSWORD: 'same',
          SEED_DEMO_DATA: 'true',
          DEMO_USER_PASSWORD: 'same',
        }),
      ),
    ).toThrow(/must differ/);
  });

  it.each(['false', '', 'yes', '1'])('production treats SEED_DEMO_DATA=%j as disabled', (v) => {
    const cfg = resolveSeedConfig(
      env({ NODE_ENV: 'production', ADMIN_PASSWORD: 'a', SEED_DEMO_DATA: v }),
    );
    expect(cfg.seedDemoData).toBe(false);
  });
});

describe('resolveSeedConfig — development / CI', () => {
  it('seeds demo accounts with the shared dev default password', () => {
    const cfg = resolveSeedConfig(env({ NODE_ENV: 'test' }));
    expect(cfg.seedDemoData).toBe(true);
    expect(cfg.adminPassword).toBe(DEV_DEFAULT_PASSWORD);
    expect(cfg.demoPassword).toBe(DEV_DEFAULT_PASSWORD);
  });

  it('honours SEED_DEFAULT_PASSWORD for admin and demo accounts', () => {
    const cfg = resolveSeedConfig(env({ SEED_DEFAULT_PASSWORD: 'shared-dev' }));
    expect(cfg.adminPassword).toBe('shared-dev');
    expect(cfg.demoPassword).toBe('shared-dev');
  });

  it('never gives demo accounts ADMIN_PASSWORD', () => {
    const cfg = resolveSeedConfig(env({ ADMIN_PASSWORD: 'admin-only' }));
    expect(cfg.demoPassword).toBe(DEV_DEFAULT_PASSWORD);
    expect(cfg.demoPassword).not.toBe('admin-only');
  });
});
