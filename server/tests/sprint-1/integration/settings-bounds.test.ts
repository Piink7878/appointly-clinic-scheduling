// ==============================================================================
// Appointly Server — Clinic Settings Upper-Bound Tests (F-007)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.7 & 2.7 (AC-F007-03)
// The contract sets lower bounds only. Hour-based settings are also capped at one
// year (8760 h) so an absurd value is a 400, never a database overflow / 500.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';
import { prisma } from '../../../src/shared/database';

import { cookiesOf } from '../../helpers';
describe('Clinic settings upper bounds (F-007)', () => {
  let adminCookies: string[];
  let original: Awaited<ReturnType<typeof prisma.clinicSetting.findFirstOrThrow>>;
  let startedAt: Date;

  const patch = (body: object) =>
    request(app).patch('/api/v1/admin/settings').set('Cookie', adminCookies).send(body);

  beforeAll(async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@appointly.local', password: 'ChangeMe123!' });
    expect(login.status).toBe(200);
    adminCookies = cookiesOf(login);
    original = await prisma.clinicSetting.findFirstOrThrow();
    startedAt = new Date();
  });

  afterAll(async () => {
    await prisma.clinicSetting.update({
      where: { settingId: original.settingId },
      data: {
        cancellationCutoffHours: original.cancellationCutoffHours,
        reminderLeadHours: original.reminderLeadHours,
      },
    });
    await prisma.auditLog.deleteMany({ where: { entityId: original.settingId, createdAt: { gte: startedAt } } });
  });

  it('cancellationCutoffHours of 8760 is accepted (200) and 8761 is rejected (400)', async () => {
    expect((await patch({ cancellationCutoffHours: 8760 })).status).toBe(200);
    expect((await prisma.clinicSetting.findFirstOrThrow()).cancellationCutoffHours).toBe(8760);

    const res = await patch({ cancellationCutoffHours: 8761 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('8760');
    expect((await prisma.clinicSetting.findFirstOrThrow()).cancellationCutoffHours).toBe(8760);
  });

  it('a value beyond the 32-bit integer range is a clean 400, not a 500', async () => {
    for (const value of [2_147_483_648, 99_999_999_999]) {
      const res = await patch({ cancellationCutoffHours: value });
      expect(res.status, String(value)).toBe(400);
    }
  });

  it('reminderLeadHours is capped the same way (8760 ok, 8761 rejected)', async () => {
    expect((await patch({ reminderLeadHours: 8760 })).status).toBe(200);
    expect((await patch({ reminderLeadHours: 8761 })).status).toBe(400);
    expect((await patch({ reminderLeadHours: 99_999_999_999 })).status).toBe(400);
  });

  it('the lower bounds still hold: cutoff 0 is accepted, -1 is rejected', async () => {
    expect((await patch({ cancellationCutoffHours: 0 })).status).toBe(200);
    expect((await patch({ cancellationCutoffHours: -1 })).status).toBe(400);
    expect((await patch({ reminderLeadHours: 0 })).status).toBe(400);
  });
});
