// ==============================================================================
// Appointly Server — Schedule Exception Validation Defect Tests (DEF-AP-02, DEF-AP-03)
// ==============================================================================
// Covers UAT release-blocking defects reported by EquipFlow:
//   - DEF-AP-02 Path A: Duplicate full-day HOLIDAY on the same date -> 409 Conflict
//   - DEF-AP-02 Path B: Partial-day exception overlapping full-day HOLIDAY -> 409 Conflict
//   - DEF-AP-03: Past-date exception (compared against Asia/Bangkok today) -> 400 VALIDATION_ERROR
//   - Happy-path guard: Non-overlapping partial-day exceptions on the same future date -> 201 Created
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';
import { prisma } from '../../../src/shared/database';
import { cookiesOf } from '../../helpers';

describe('Schedule Exception Validation Defects (DEF-AP-02, DEF-AP-03)', () => {
  const validPassword = 'ChangeMe123!';
  const doctorEmail = 'doctor@appointly.local';

  const TEST_DATES = [
    new Date('2026-12-31T00:00:00.000Z'),
    new Date('2026-12-30T00:00:00.000Z'),
    new Date('2020-01-01T00:00:00.000Z'),
    new Date('2027-01-15T00:00:00.000Z'),
  ];

  let doctorCookies: string[];
  let primaryDoctorId: string;
  const createdExceptionIds: string[] = [];

  async function cleanTestDateExceptions() {
    if (!primaryDoctorId) return;
    await prisma.scheduleException.deleteMany({
      where: {
        doctorId: primaryDoctorId,
        exceptionDate: { in: TEST_DATES },
      },
    });
  }

  beforeAll(async () => {
    const doctorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: doctorEmail, password: validPassword });
    expect(doctorLogin.status).toBe(200);
    doctorCookies = cookiesOf(doctorLogin);

    const docProfile = await prisma.doctor.findUnique({
      where: { userId: doctorLogin.body.data.userId },
    });
    expect(docProfile).toBeDefined();
    primaryDoctorId = docProfile!.doctorId;

    // Clean up any leftover test rows from previous runs (e.g., RED -> GREEN)
    await cleanTestDateExceptions();
  });

  afterAll(async () => {
    if (createdExceptionIds.length > 0) {
      await prisma.scheduleException.deleteMany({
        where: { exceptionId: { in: createdExceptionIds } },
      });
    }
    await cleanTestDateExceptions();
  });

  // --------------------------------------------------------------------------
  // DEF-AP-02 Path A — Duplicate full-day HOLIDAY on the same date
  // --------------------------------------------------------------------------
  describe('DEF-AP-02 Path A — Duplicate full-day HOLIDAY on the same date', () => {
    it('rejects a second full-day HOLIDAY on 2026-12-31 with 409 SCHEDULE_EXCEPTION_CONFLICT', async () => {
      const first = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({
          exceptionDate: '2026-12-31',
          exceptionType: 'HOLIDAY',
          reason: 'Test Path A first holiday',
        });
      expect(first.status).toBe(201);
      createdExceptionIds.push(first.body.data.exceptionId);

      const second = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({
          exceptionDate: '2026-12-31',
          exceptionType: 'HOLIDAY',
          reason: 'Test Path A duplicate holiday',
        });
      expect(second.status).toBe(409);
      expect(second.body.success).toBe(false);
      expect(second.body.error.code).toBe('SCHEDULE_EXCEPTION_CONFLICT');
    });
  });

  // --------------------------------------------------------------------------
  // DEF-AP-02 Path B — Partial-day exception overlapping full-day HOLIDAY
  // --------------------------------------------------------------------------
  describe('DEF-AP-02 Path B — Partial-day overlaps existing full-day HOLIDAY', () => {
    it('rejects partial 13:00-17:00 HOLIDAY on 2026-12-30 when full-day HOLIDAY exists with 409 SCHEDULE_EXCEPTION_CONFLICT', async () => {
      const fullDay = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({
          exceptionDate: '2026-12-30',
          exceptionType: 'HOLIDAY',
          reason: 'Full-day Path B holiday',
        });
      expect(fullDay.status).toBe(201);
      createdExceptionIds.push(fullDay.body.data.exceptionId);

      const partial = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({
          exceptionDate: '2026-12-30',
          exceptionType: 'HOLIDAY',
          startTime: '13:00',
          endTime: '17:00',
          reason: 'Partial-day overlapping full-day',
        });
      expect(partial.status).toBe(409);
      expect(partial.body.success).toBe(false);
      expect(partial.body.error.code).toBe('SCHEDULE_EXCEPTION_CONFLICT');
    });
  });

  // --------------------------------------------------------------------------
  // DEF-AP-03 — Past-date schedule exception rejected
  // --------------------------------------------------------------------------
  describe('DEF-AP-03 — Past date rejected', () => {
    it('rejects exceptionDate 2020-01-01 with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({
          exceptionDate: '2020-01-01',
          exceptionType: 'HOLIDAY',
          reason: 'Past date defect test',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/past/i);
    });
  });

  // --------------------------------------------------------------------------
  // Happy-path guard — Non-overlapping partial exceptions on same future date
  // --------------------------------------------------------------------------
  describe('Happy-path guard — Non-overlapping partial exceptions on same future date', () => {
    it('allows two non-overlapping partial-day exceptions (09:00-12:00 and 13:00-17:00) on 2027-01-15', async () => {
      const morning = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({
          exceptionDate: '2027-01-15',
          exceptionType: 'BREAK',
          startTime: '09:00',
          endTime: '12:00',
          reason: 'Morning break',
        });
      expect(morning.status).toBe(201);
      createdExceptionIds.push(morning.body.data.exceptionId);

      const afternoon = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({
          exceptionDate: '2027-01-15',
          exceptionType: 'BREAK',
          startTime: '13:00',
          endTime: '17:00',
          reason: 'Afternoon break',
        });
      expect(afternoon.status).toBe(201);
      createdExceptionIds.push(afternoon.body.data.exceptionId);
    });
  });
});
