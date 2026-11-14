// ==============================================================================
// Appointly Server — Administrator Schedule & Clinic Configuration Tests (F-007)
// ==============================================================================
// Reference: System-Level SDS Section 3.2F, 3.2G, 3.2K, 3.2L, 5.2, 6 &
//            Sprint 1 Contracts (Section 1.7, 2.7: AC-F007-01..03 & Section 3.2: STS-S1-009)
// Database: PostgreSQL Test DB via Prisma ORM + Supertest
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';
import { prisma } from '../../../src/shared/database';

import { cookiesOf } from '../../helpers';
describe('F-007: Administrator Schedule & Clinic Configuration (STS-S1-009)', () => {
  const validPassword = 'ChangeMe123!';
  const adminEmail = 'admin@appointly.local';
  const doctorEmail = 'doctor@appointly.local';
  const patientEmail = 'patient.arisa@appointly.local';

  let adminCookies: string[];
  let doctorCookies: string[];
  let patientCookies: string[];

  let adminUserId: string;
  let doctorD1Id: string;

  const createdExceptionIds: string[] = [];

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: validPassword });
    expect(adminLogin.status).toBe(200);
    adminCookies = cookiesOf(adminLogin);
    adminUserId = adminLogin.body.data.userId;

    // 2. Authenticate Doctor
    const doctorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: doctorEmail, password: validPassword });
    expect(doctorLogin.status).toBe(200);
    doctorCookies = cookiesOf(doctorLogin);

    // Resolve Doctor D1 profile ID from database
    const doctorProfile = await prisma.doctor.findUnique({
      where: { userId: doctorLogin.body.data.userId },
    });
    expect(doctorProfile).toBeDefined();
    doctorD1Id = doctorProfile!.doctorId;

    // 3. Authenticate Patient
    const patientLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: patientEmail, password: validPassword });
    expect(patientLogin.status).toBe(200);
    patientCookies = cookiesOf(patientLogin);
  });

  afterAll(async () => {
    // 1. Clean up created schedule exceptions
    if (createdExceptionIds.length > 0) {
      await prisma.scheduleException.deleteMany({
        where: { exceptionId: { in: createdExceptionIds } },
      });
    }

    // 2. Restore doctor D1 baseline weekly recurring shifts
    await prisma.doctorSchedule.deleteMany({
      where: { doctorId: doctorD1Id },
    });

    const baselineShifts = [];
    for (let day = 1; day <= 5; day++) {
      baselineShifts.push(
        {
          doctorId: doctorD1Id,
          dayOfWeek: day,
          startTime: '09:00:00',
          endTime: '12:00:00',
          isActive: true,
        },
        {
          doctorId: doctorD1Id,
          dayOfWeek: day,
          startTime: '13:00:00',
          endTime: '17:00:00',
          isActive: true,
        }
      );
    }
    await prisma.doctorSchedule.createMany({ data: baselineShifts });

    // 3. Restore default ClinicSetting singleton record
    const setting = await prisma.clinicSetting.findFirst();
    if (setting) {
      await prisma.clinicSetting.update({
        where: { settingId: setting.settingId },
        data: {
          clinicName: 'Appointly Clinic',
          timezone: 'Asia/Bangkok',
          fixedStartIntervalMinutes: 15,
          cancellationCutoffHours: 24,
          reminderLeadHours: 24,
        },
      });
    }
  });

  // ============================================================================
  // 1. AC-F007-01 (Positive — Admin Override & Clinic Config + AuditLog)
  // ============================================================================
  describe('1. AC-F007-01 (Positive — Admin Schedule Override & Clinic Settings Update + AuditLog)', () => {
    it('Admin successfully updates doctor D1 schedule via PUT /api/v1/admin/doctors/:doctorId/schedule and records an AuditLog', async () => {
      const schedulePayload = {
        schedules: [
          { dayOfWeek: 1, startTime: '08:30', endTime: '12:00' },
          { dayOfWeek: 1, startTime: '13:00', endTime: '16:30' },
        ],
        reason: 'Administrative schedule adjustment for Doctor D1',
      };

      const res = await request(app)
        .put(`/api/v1/admin/doctors/${doctorD1Id}/schedule`)
        .set('Cookie', adminCookies)
        .send(schedulePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.weeklySchedules).toHaveLength(2);

      // Verify PostgreSQL persistence
      const persistedShifts = await prisma.doctorSchedule.findMany({
        where: { doctorId: doctorD1Id },
      });
      expect(persistedShifts).toHaveLength(2);

      // Verify AuditLog record in PostgreSQL
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: doctorD1Id,
          userId: adminUserId,
          actionType: 'ADMIN_SCHEDULE_UPDATE',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(adminUserId);
      expect(auditLog?.entityType).toBe('DoctorSchedule');
      expect(auditLog?.entityId).toBe(doctorD1Id);
    });

    it('Admin successfully adds an exception for doctor D1 via POST /api/v1/admin/doctors/:doctorId/exceptions and records an AuditLog', async () => {
      const exceptionPayload = {
        exceptionDate: '2026-12-25',
        exceptionType: 'HOLIDAY',
        reason: 'Christmas Day Official Clinic Holiday',
      };

      const res = await request(app)
        .post(`/api/v1/admin/doctors/${doctorD1Id}/exceptions`)
        .set('Cookie', adminCookies)
        .send(exceptionPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exceptionId).toBeDefined();
      createdExceptionIds.push(res.body.data.exceptionId);

      // Verify PostgreSQL persistence
      const persistedException = await prisma.scheduleException.findUnique({
        where: { exceptionId: res.body.data.exceptionId },
      });
      expect(persistedException).toBeDefined();
      expect(persistedException?.exceptionType).toBe('HOLIDAY');
      expect(persistedException?.doctorId).toBe(doctorD1Id);

      // Verify AuditLog record in PostgreSQL
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: res.body.data.exceptionId,
          userId: adminUserId,
          actionType: 'ADMIN_SCHEDULE_EXCEPTION_CREATED',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(adminUserId);
      expect(auditLog?.entityType).toBe('ScheduleException');
    });

    it('Admin successfully updates clinic settings via PATCH /api/v1/admin/settings, GET /api/v1/settings/public returns matching values, and records an AuditLog', async () => {
      const settingsPayload = {
        clinicName: 'Appointly Specialist Clinic',
        timezone: 'Asia/Bangkok',
        fixedStartIntervalMinutes: 15,
        cancellationCutoffHours: 24,
      };

      const patchRes = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', adminCookies)
        .send(settingsPayload);

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);
      expect(patchRes.body.data.clinicName).toBe(settingsPayload.clinicName);
      expect(patchRes.body.data.timezone).toBe(settingsPayload.timezone);
      expect(patchRes.body.data.fixedStartIntervalMinutes).toBe(15);
      expect(patchRes.body.data.cancellationCutoffHours).toBe(24);

      // Verify public endpoint returns matching values
      const publicRes = await request(app).get('/api/v1/settings/public');
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.success).toBe(true);
      expect(publicRes.body.data.clinicName).toBe(settingsPayload.clinicName);
      expect(publicRes.body.data.timezone).toBe(settingsPayload.timezone);
      expect(publicRes.body.data.fixedStartIntervalMinutes).toBe(15);
      expect(publicRes.body.data.cancellationCutoffHours).toBe(24);

      // Verify AuditLog record in PostgreSQL
      const setting = await prisma.clinicSetting.findFirst();
      expect(setting).toBeDefined();

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          actionType: 'CLINIC_SETTINGS_UPDATED',
          entityType: 'ClinicSetting',
          entityId: setting!.settingId,
          userId: adminUserId,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actionType).toBe('CLINIC_SETTINGS_UPDATED');
      expect(auditLog?.userId).toBe(adminUserId);
      expect(auditLog?.entityId).toBe(setting!.settingId);
    });
  });

  // ============================================================================
  // 2. AC-F007-02 (Negative — RBAC & Invalid Timezone)
  // ============================================================================
  describe('2. AC-F007-02 (Negative — RBAC Privilege Escalation & Invalid Timezone)', () => {
    it('DOCTOR attempting to call PATCH /api/v1/admin/settings is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', doctorCookies)
        .send({ clinicName: 'Doctor Unauthorized Change' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('DOCTOR attempting to call PUT /api/v1/admin/doctors/:doctorId/schedule is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/doctors/${doctorD1Id}/schedule`)
        .set('Cookie', doctorCookies)
        .send({
          schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('PATIENT attempting to call PATCH /api/v1/admin/settings is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', patientCookies)
        .send({ clinicName: 'Patient Unauthorized Change' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('PATIENT attempting to call PUT /api/v1/admin/doctors/:doctorId/schedule is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/doctors/${doctorD1Id}/schedule`)
        .set('Cookie', patientCookies)
        .send({
          schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Admin submitting timezone: "Invalid/Zone" is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', adminCookies)
        .send({ timezone: 'Invalid/Zone' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('Admin submitting fictional timezone "Mars/Olympus" is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', adminCookies)
        .send({ timezone: 'Mars/Olympus' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================================
  // 3. AC-F007-03 (Boundary — Interval & Cancellation Cutoff Limits)
  // ============================================================================
  describe('3. AC-F007-03 (Boundary — Interval & Cancellation Cutoff Limits)', () => {
    it('Submitting fixedStartIntervalMinutes as 0 returns 400 Bad Request', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', adminCookies)
        .send({ fixedStartIntervalMinutes: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('Submitting fixedStartIntervalMinutes as unsupported value 7 returns 400 Bad Request', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', adminCookies)
        .send({ fixedStartIntervalMinutes: 7 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('Submitting cancellationCutoffHours as 0 succeeds (200 OK)', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', adminCookies)
        .send({ cancellationCutoffHours: 0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cancellationCutoffHours).toBe(0);

      // Verify PostgreSQL persistence
      const setting = await prisma.clinicSetting.findFirst();
      expect(setting?.cancellationCutoffHours).toBe(0);
    });

    it('Submitting cancellationCutoffHours as -1 returns 400 Bad Request', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', adminCookies)
        .send({ cancellationCutoffHours: -1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

