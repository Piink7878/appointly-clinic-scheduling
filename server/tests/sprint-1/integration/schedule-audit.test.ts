// ==============================================================================
// Appointly Server — Administrator Schedule & Settings Audit Trail Tests (F-007)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.7 & 2.7 (AC-F007-01); System-Level SDS 7.3
// Every administrator override writes exactly ONE AuditLog row (actor, action
// type, entity, details, UTC timestamp). A doctor changing their own schedule is
// not an administrative override and writes none.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';
import { prisma } from '../../../src/shared/database';

import { cookiesOf } from '../../helpers';
describe('Administrator schedule & settings audit trail (F-007)', () => {
  const validPassword = 'ChangeMe123!';
  const stamp = Date.now();

  let adminCookies: string[];
  let doctorCookies: string[];
  let adminUserId: string;
  let doctorId: string; // the seeded doctor, also the logged-in "doctor" account
  const createdExceptionIds: string[] = [];

  const login = async (email: string) => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: validPassword });
    expect(res.status).toBe(200);
    return res;
  };

  const auditRowsFor = (entityId: string, since: Date) =>
    prisma.auditLog.findMany({ where: { entityId, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    const adminLogin = await login('admin@appointly.local');
    adminCookies = cookiesOf(adminLogin);
    adminUserId = adminLogin.body.data.userId;
    doctorCookies = cookiesOf((await login('doctor@appointly.local')));

    const doctor = await prisma.doctor.findFirstOrThrow({ where: { user: { email: 'doctor@appointly.local' } } });
    doctorId = doctor.doctorId;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [...createdExceptionIds, doctorId] }, userId: adminUserId, createdAt: { gte: new Date(stamp) } } });
    await prisma.scheduleException.deleteMany({ where: { exceptionId: { in: createdExceptionIds } } });
  });

  it('PUT /admin/doctors/:id/schedule writes exactly one ADMIN_SCHEDULE_UPDATE row with the actor, reason and shift count', async () => {
    // Keep the seeded doctor's real hours: read them first and put them back afterwards.
    const original = await prisma.doctorSchedule.findMany({ where: { doctorId } });
    const since = new Date();

    const res = await request(app)
      .put(`/api/v1/admin/doctors/${doctorId}/schedule`)
      .set('Cookie', adminCookies)
      .send({
        shifts: [
          { dayOfWeek: 2, startTime: '09:00', endTime: '12:00', isActive: true },
          { dayOfWeek: 2, startTime: '13:00', endTime: '17:00', isActive: true },
        ],
        reason: `Covering a colleague ${stamp}`,
      });
    expect(res.status).toBe(200);

    const rows = await auditRowsFor(doctorId, since);
    expect(rows).toHaveLength(1);
    expect(rows[0].actionType).toBe('ADMIN_SCHEDULE_UPDATE');
    expect(rows[0].userId).toBe(adminUserId);
    expect(rows[0].entityType).toBe('DoctorSchedule');
    expect(rows[0].details).toMatchObject({ reason: `Covering a colleague ${stamp}`, shiftsCount: 2 });
    expect(rows[0].createdAt.getTime()).toBeGreaterThanOrEqual(since.getTime());

    // restore the seeded schedule
    await prisma.doctorSchedule.deleteMany({ where: { doctorId } });
    if (original.length > 0) {
      await prisma.doctorSchedule.createMany({
        data: original.map(({ doctorId: d, dayOfWeek, startTime, endTime, isActive }) => ({
          doctorId: d,
          dayOfWeek,
          startTime,
          endTime,
          isActive,
        })),
      });
    }
  });

  it.each([
    ['is missing', undefined],
    ['is empty', ''],
    ['is only whitespace', '   '],
    ['is not text', 42],
  ])('an administrator override whose reason %s is refused (400): nothing saved, nothing audited (SDS 6.1)', async (_label, reason) => {
    const original = await prisma.doctorSchedule.findMany({ where: { doctorId } });
    const since = new Date();
    const res = await request(app)
      .put(`/api/v1/admin/doctors/${doctorId}/schedule`)
      .set('Cookie', adminCookies)
      .send({
        shifts: [{ dayOfWeek: 3, startTime: '10:00', endTime: '11:00', isActive: true }],
        ...(reason === undefined ? {} : { reason }),
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    expect(await auditRowsFor(doctorId, since)).toHaveLength(0);
    expect(await prisma.doctorSchedule.count({ where: { doctorId } })).toBe(original.length);
  });

  it('the reason is stored trimmed in the audit entry, and overrideReason is accepted as an alias', async () => {
    const original = await prisma.doctorSchedule.findMany({ where: { doctorId } });
    const since = new Date();
    const res = await request(app)
      .put(`/api/v1/admin/doctors/${doctorId}/schedule`)
      .set('Cookie', adminCookies)
      .send({
        shifts: original.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, isActive: s.isActive })),
        overrideReason: '  Aliased reason  ',
      });
    expect(res.status).toBe(200);
    const rows = await auditRowsFor(doctorId, since);
    expect(rows.map((r) => r.actionType)).toEqual(['ADMIN_SCHEDULE_UPDATE']);
    expect(rows[0].details).toMatchObject({ reason: 'Aliased reason' });
  });

  it('an administrator-created exception without a reason is refused (400) and writes nothing', async () => {
    const since = new Date();
    const before = await prisma.scheduleException.count({ where: { doctorId } });
    for (const body of [
      { exceptionDate: '2099-04-01', exceptionType: 'HOLIDAY' },
      { exceptionDate: '2099-04-01', exceptionType: 'HOLIDAY', reason: '   ' },
    ]) {
      const res = await request(app).post(`/api/v1/admin/doctors/${doctorId}/exceptions`).set('Cookie', adminCookies).send(body);
      expect(res.status).toBe(400);
    }
    expect(await prisma.scheduleException.count({ where: { doctorId } })).toBe(before);
    expect(await auditRowsFor(doctorId, since)).toHaveLength(0);
  });

  it('a rejected PUT (422 overlap) writes no audit row and leaves the schedule unchanged', async () => {
    const before = await prisma.doctorSchedule.count({ where: { doctorId } });
    const since = new Date();
    const res = await request(app)
      .put(`/api/v1/admin/doctors/${doctorId}/schedule`)
      .set('Cookie', adminCookies)
      .send({
        shifts: [
          { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
          { dayOfWeek: 3, startTime: '12:00', endTime: '16:00' },
        ],
        reason: 'should not be recorded',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_SCHEDULE_WINDOW');

    expect(await auditRowsFor(doctorId, since)).toHaveLength(0);
    expect(await prisma.doctorSchedule.count({ where: { doctorId } })).toBe(before);
  });

  it('admin POST and DELETE of an exception each write exactly one row', async () => {
    const since = new Date();
    const created = await request(app)
      .post(`/api/v1/admin/doctors/${doctorId}/exceptions`)
      .set('Cookie', adminCookies)
      .send({ exceptionDate: '2099-03-15', exceptionType: 'HOLIDAY', reason: `Audit test ${stamp}` });
    expect(created.status).toBe(201);
    const exceptionId = created.body.data.exceptionId as string;
    createdExceptionIds.push(exceptionId);

    let rows = await auditRowsFor(exceptionId, since);
    expect(rows.map((r) => r.actionType)).toEqual(['ADMIN_SCHEDULE_EXCEPTION_CREATED']);
    expect(rows[0].userId).toBe(adminUserId);
    expect(rows[0].details).toMatchObject({ doctorId, exceptionType: 'HOLIDAY', reason: `Audit test ${stamp}` });

    const removed = await request(app)
      .delete(`/api/v1/admin/doctors/${doctorId}/exceptions/${exceptionId}`)
      .set('Cookie', adminCookies);
    expect(removed.status).toBe(200);

    rows = await auditRowsFor(exceptionId, since);
    expect(rows.map((r) => r.actionType)).toEqual([
      'ADMIN_SCHEDULE_EXCEPTION_CREATED',
      'ADMIN_SCHEDULE_EXCEPTION_DELETED',
    ]);
  });

  it('a rejected exception (inverted window) creates neither a row nor an audit entry', async () => {
    const since = new Date();
    const before = await prisma.scheduleException.count({ where: { doctorId } });
    const res = await request(app)
      .post(`/api/v1/admin/doctors/${doctorId}/exceptions`)
      .set('Cookie', adminCookies)
      .send({ exceptionDate: '2099-03-16', exceptionType: 'BREAK', startTime: '14:00', endTime: '10:00', reason: 'Inverted' });
    expect(res.status).toBe(422);

    expect(await prisma.scheduleException.count({ where: { doctorId } })).toBe(before);
    expect(await prisma.auditLog.count({ where: { userId: adminUserId, createdAt: { gte: since }, actionType: 'ADMIN_SCHEDULE_EXCEPTION_CREATED' } })).toBe(0);
  });

  it('a doctor changing their own schedule is not an administrative override: no audit row', async () => {
    const original = await prisma.doctorSchedule.findMany({ where: { doctorId } });
    const since = new Date();
    const res = await request(app)
      .put('/api/v1/doctors/me/schedule')
      .set('Cookie', doctorCookies)
      .send({ shifts: original.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, isActive: s.isActive })) });
    expect(res.status).toBe(200);
    expect(await auditRowsFor(doctorId, since)).toHaveLength(0);
  });

  it('PATCH /admin/settings writes exactly one CLINIC_SETTINGS_UPDATED row with the previous and new values', async () => {
    const current = await prisma.clinicSetting.findFirstOrThrow();
    const since = new Date();
    const nextCutoff = current.cancellationCutoffHours === 12 ? 36 : 12;

    try {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', adminCookies)
        .send({ cancellationCutoffHours: nextCutoff });
      expect(res.status).toBe(200);

      const rows = await auditRowsFor(current.settingId, since);
      expect(rows).toHaveLength(1);
      expect(rows[0].actionType).toBe('CLINIC_SETTINGS_UPDATED');
      expect(rows[0].userId).toBe(adminUserId);
      expect(rows[0].entityType).toBe('ClinicSetting');
      expect(rows[0].details).toMatchObject({
        updatedFields: ['cancellationCutoffHours'],
        previous: { cancellationCutoffHours: current.cancellationCutoffHours },
        current: { cancellationCutoffHours: nextCutoff },
      });
    } finally {
      await prisma.clinicSetting.update({
        where: { settingId: current.settingId },
        data: { cancellationCutoffHours: current.cancellationCutoffHours },
      });
      await prisma.auditLog.deleteMany({ where: { entityId: current.settingId, createdAt: { gte: since } } });
    }
  });

  it('a rejected settings update (timezone Mars/Olympus) writes no audit row and changes nothing', async () => {
    const current = await prisma.clinicSetting.findFirstOrThrow();
    const since = new Date();
    const res = await request(app)
      .patch('/api/v1/admin/settings')
      .set('Cookie', adminCookies)
      .send({ timezone: 'Mars/Olympus' });
    expect(res.status).toBe(400);

    expect(await auditRowsFor(current.settingId, since)).toHaveLength(0);
    expect((await prisma.clinicSetting.findFirstOrThrow()).timezone).toBe(current.timezone);
  });
});
