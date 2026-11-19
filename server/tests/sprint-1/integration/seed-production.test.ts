// ==============================================================================
// Appointly Server — Seed policy against a real database
// ==============================================================================
// Production seeding is create-if-missing for the Admin account, Clinic Settings
// and Medical Services: a release must never overwrite what administrators
// changed. An explicit ADMIN_PASSWORD_RESET=true rotates the admin password hash
// only. Dev/CI seeding still resets everything to the known defaults.
//
// Uses a dedicated admin e-mail (SEED_ADMIN_EMAIL) so the real admin account is
// never touched; shared rows (clinic setting, services) are snapshotted and
// restored in afterAll.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, AccountStatus, Role, ServiceStatus } from '@prisma/client';
import argon2 from 'argon2';
import { resolveSeedConfig } from '../../../prisma/seed-config';
import { runSeed } from '../../../prisma/seed-runner';

const prisma = new PrismaClient();
const ADMIN_EMAIL = `seed.policy.${Date.now()}@appointly.local`;
const SERVICE = 'Flu Vaccination';

const prodEnv = (extra: Record<string, string> = {}) =>
  ({
    NODE_ENV: 'production',
    ADMIN_PASSWORD: 'First-Admin-Pw-1',
    SEED_ADMIN_EMAIL: ADMIN_EMAIL,
    ...extra,
  }) as NodeJS.ProcessEnv;

const seedProd = (extra: Record<string, string> = {}) => runSeed(prisma, resolveSeedConfig(prodEnv(extra)));
const getAdmin = () => prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
const getSetting = () => prisma.clinicSetting.findFirstOrThrow();
const getService = () => prisma.medicalService.findUniqueOrThrow({ where: { serviceName: SERVICE } });

let settingSnapshot: Awaited<ReturnType<typeof prisma.clinicSetting.findFirst>>;
let serviceSnapshot: Awaited<ReturnType<typeof prisma.medicalService.findUnique>>;
let demoHashBefore: string | undefined;

describe('Seed policy (production vs dev/CI)', () => {
  beforeAll(async () => {
    // Make sure settings and services exist, then remember them so we can restore.
    await seedProd();
    settingSnapshot = await prisma.clinicSetting.findFirst();
    serviceSnapshot = await prisma.medicalService.findUnique({ where: { serviceName: SERVICE } });
    demoHashBefore = (await prisma.user.findUnique({ where: { email: 'doctor@appointly.local' } }))?.passwordHash;
  });

  afterAll(async () => {
    if (settingSnapshot) {
      const { settingId, ...data } = settingSnapshot;
      await prisma.clinicSetting.update({ where: { settingId }, data });
    }
    if (serviceSnapshot) {
      const { serviceId, ...data } = serviceSnapshot;
      await prisma.medicalService.update({ where: { serviceId }, data });
    }
    await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('creates the admin when missing, with ADMIN_PASSWORD, ACTIVE and ADMIN role', async () => {
    const admin = await getAdmin();
    expect(admin.role).toBe(Role.ADMIN);
    expect(admin.accountStatus).toBe(AccountStatus.ACTIVE);
    expect(await argon2.verify(admin.passwordHash, 'First-Admin-Pw-1')).toBe(true);
  });

  it('keeps an existing INACTIVE admin inactive (status and password untouched)', async () => {
    await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { accountStatus: AccountStatus.INACTIVE } });
    const before = await getAdmin();

    await seedProd({ ADMIN_PASSWORD: 'Different-Pw-2' });

    const after = await getAdmin();
    expect(after.accountStatus).toBe(AccountStatus.INACTIVE);
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.role).toBe(Role.ADMIN);
  });

  it('leaves existing Clinic Settings unchanged', async () => {
    const setting = await getSetting();
    await prisma.clinicSetting.update({
      where: { settingId: setting.settingId },
      data: { clinicName: 'Edited By Admin', cancellationCutoffHours: 48, reminderLeadHours: 6 },
    });
    const before = await getSetting();

    await seedProd();

    expect(await getSetting()).toEqual(before);
    expect((await getSetting()).clinicName).toBe('Edited By Admin');
  });

  it('leaves existing Medical Services unchanged (status, duration, description)', async () => {
    await prisma.medicalService.update({
      where: { serviceName: SERVICE },
      data: { serviceStatus: ServiceStatus.INACTIVE, durationMinutes: 20, description: 'Edited description' },
    });
    const before = await getService();

    await seedProd();

    expect(await getService()).toEqual(before);
    expect((await getService()).serviceStatus).toBe(ServiceStatus.INACTIVE);
  });

  it('does not touch existing demo accounts when demo seeding is off', async () => {
    await seedProd();
    const hash = (await prisma.user.findUnique({ where: { email: 'doctor@appointly.local' } }))?.passwordHash;
    expect(hash).toBe(demoHashBefore);
  });

  it('ADMIN_PASSWORD_RESET=true rotates the password hash only (role and status unchanged)', async () => {
    const before = await getAdmin();
    expect(before.accountStatus).toBe(AccountStatus.INACTIVE); // still inactive from the earlier test

    await seedProd({ ADMIN_PASSWORD: 'Rotated-Pw-3', ADMIN_PASSWORD_RESET: 'true' });

    const after = await getAdmin();
    expect(await argon2.verify(after.passwordHash, 'Rotated-Pw-3')).toBe(true);
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(after.role).toBe(before.role);
    expect(after.accountStatus).toBe(AccountStatus.INACTIVE);
    expect(after.email).toBe(before.email);
  });

  it('a later seed without the flag does not rotate again (flag is not sticky)', async () => {
    const before = await getAdmin();
    await seedProd({ ADMIN_PASSWORD: 'Another-Pw-4' });
    expect((await getAdmin()).passwordHash).toBe(before.passwordHash);
  });

  it('running the production seed repeatedly overwrites nothing', async () => {
    await seedProd();
    const snapshot = {
      admin: await getAdmin(),
      setting: await getSetting(),
      service: await getService(),
    };

    for (let run = 0; run < 3; run += 1) {
      await seedProd({ ADMIN_PASSWORD: `Run-${run}-Pw-5` });
    }

    expect(await getAdmin()).toEqual(snapshot.admin);
    expect(await getSetting()).toEqual(snapshot.setting);
    expect(await getService()).toEqual(snapshot.service);
  });

  it('dev/CI seeding still resets the admin, clinic settings and services to defaults', async () => {
    // Same env as `npm run prisma:seed` in dev/CI; only the admin e-mail differs.
    const devEnv = { ...process.env, NODE_ENV: 'test', SEED_ADMIN_EMAIL: ADMIN_EMAIL } as NodeJS.ProcessEnv;
    delete devEnv.SEED_DEMO_DATA;

    await runSeed(prisma, resolveSeedConfig(devEnv));

    const admin = await getAdmin();
    expect(admin.accountStatus).toBe(AccountStatus.ACTIVE);
    expect(admin.role).toBe(Role.ADMIN);
    expect((await getSetting()).clinicName).toBe('Appointly Clinic');
    expect((await getSetting()).cancellationCutoffHours).toBe(24);
    const service = await getService();
    expect(service.serviceStatus).toBe(ServiceStatus.ACTIVE);
    expect(service.durationMinutes).toBe(15);
  });
});
