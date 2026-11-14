// ==============================================================================
// Appointly Server — Doctor Schedule Management Integration & API Tests (F-006, F-007)
// ==============================================================================
// Reference: System-Level SDS Section 3.2F, 3.2G, 5.2, 5.3, 6 & Sprint 1 Contracts (Section 1.6, 2.6, 3.2: STS-S1-008)
// Test Catalog: STS-S1-008, STS-S1-002, STS-S1-003, STS-S1-009
// Acceptance Criteria Covered:
//   - AC-F006-01 (Positive — Split Shifts & Persistence)
//   - AC-F006-02 (Negative — Overlapping & Invalid Windows + Ownership/RBAC)
//   - AC-F006-03 (Boundary — Adjacent Shifts & Full-Day Holiday Exception)
//   - AC-F007-01 (Positive — Admin Schedule Governance & Overrides)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/shared/database';
import {
  scheduleValidator,
  isValidTimeFormat,
  parseTimeToSeconds,
  validateTimeWindow,
  doShiftsOverlap,
  validateShifts,
  validateException,
} from '../../src/modules/schedules/scheduleValidator';
import { AppError } from '../../src/shared/middleware/errorHandler';

describe('Doctor Schedule Management System (F-006, F-007)', () => {
  const validPassword = 'ChangeMe123!';
  const doctorEmail = 'doctor@appointly.local';
  const secondDoctorEmail = 'doctor.somchai@appointly.local';
  const patientEmail = 'patient.arisa@appointly.local';
  const adminEmail = 'admin@appointly.local';

  let doctorCookies: string[];
  let secondDoctorCookies: string[];
  let patientCookies: string[];
  let adminCookies: string[];

  let doctorUser: { userId: string; email: string };
  let secondDoctorUser: { userId: string; email: string };
  let primaryDoctorId: string;
  let secondDoctorId: string;
  let adminUserId: string;

  // Track created exceptions for cleanup
  const createdExceptionIds: string[] = [];

  beforeAll(async () => {
    // 1. Authenticate primary doctor (doctor@appointly.local)
    const doctorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: doctorEmail, password: validPassword });
    expect(doctorLogin.status).toBe(200);
    doctorCookies = doctorLogin.headers['set-cookie'];
    doctorUser = doctorLogin.body.data;

    // Resolve primary doctorId from database
    const docProfile = await prisma.doctor.findUnique({
      where: { userId: doctorUser.userId },
    });
    expect(docProfile).toBeDefined();
    primaryDoctorId = docProfile!.doctorId;

    // 2. Authenticate second doctor (doctor.somchai@appointly.local)
    const secondDoctorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: secondDoctorEmail, password: validPassword });
    expect(secondDoctorLogin.status).toBe(200);
    secondDoctorCookies = secondDoctorLogin.headers['set-cookie'];
    secondDoctorUser = secondDoctorLogin.body.data;

    const secondDocProfile = await prisma.doctor.findUnique({
      where: { userId: secondDoctorUser.userId },
    });
    expect(secondDocProfile).toBeDefined();
    secondDoctorId = secondDocProfile!.doctorId;

    // 3. Authenticate patient (patient.arisa@appointly.local)
    const patientLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: patientEmail, password: validPassword });
    expect(patientLogin.status).toBe(200);
    patientCookies = patientLogin.headers['set-cookie'];

    // 4. Authenticate admin (admin@appointly.local)
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: validPassword });
    expect(adminLogin.status).toBe(200);
    adminCookies = adminLogin.headers['set-cookie'];
    adminUserId = adminLogin.body.data.userId;
  });

  afterAll(async () => {
    // Clean up created test exceptions
    if (createdExceptionIds.length > 0) {
      await prisma.scheduleException.deleteMany({
        where: { exceptionId: { in: createdExceptionIds } },
      });
    }

    // Restore baseline shifts for primary doctor (Monday to Friday, split shifts)
    await prisma.doctorSchedule.deleteMany({
      where: { doctorId: primaryDoctorId },
    });

    const baselineShifts = [];
    for (let day = 1; day <= 5; day++) {
      baselineShifts.push(
        {
          doctorId: primaryDoctorId,
          dayOfWeek: day,
          startTime: '09:00:00',
          endTime: '12:00:00',
          isActive: true,
        },
        {
          doctorId: primaryDoctorId,
          dayOfWeek: day,
          startTime: '13:00:00',
          endTime: '17:00:00',
          isActive: true,
        }
      );
    }
    await prisma.doctorSchedule.createMany({ data: baselineShifts });
  });

  // ============================================================================
  // 1. Unit Tests: scheduleValidator Domain Logic
  // ============================================================================
  describe('1. scheduleValidator Domain Validation Unit Tests', () => {
    describe('Time format validation (HH:mm or HH:mm:ss)', () => {
      it('accepts valid HH:mm and HH:mm:ss strings', () => {
        expect(isValidTimeFormat('09:00')).toBe(true);
        expect(isValidTimeFormat('09:00:00')).toBe(true);
        expect(isValidTimeFormat('00:00')).toBe(true);
        expect(isValidTimeFormat('23:59')).toBe(true);
        expect(isValidTimeFormat('23:59:59')).toBe(true);
        expect(isValidTimeFormat('13:30:15')).toBe(true);
      });

      it('rejects invalid time strings', () => {
        expect(isValidTimeFormat('24:00')).toBe(false);
        expect(isValidTimeFormat('25:00')).toBe(false);
        expect(isValidTimeFormat('12:60')).toBe(false);
        expect(isValidTimeFormat('9:00')).toBe(false);
        expect(isValidTimeFormat('invalid')).toBe(false);
        expect(isValidTimeFormat('')).toBe(false);
        expect(isValidTimeFormat('12:00:60')).toBe(false);
      });

      it('parseTimeToSeconds converts valid formats to seconds from midnight', () => {
        expect(parseTimeToSeconds('00:00')).toBe(0);
        expect(parseTimeToSeconds('01:00')).toBe(3600);
        expect(parseTimeToSeconds('09:30')).toBe(9 * 3600 + 30 * 60);
        expect(parseTimeToSeconds('09:30:15')).toBe(9 * 3600 + 30 * 60 + 15);
      });

      it('parseTimeToSeconds throws 422 INVALID_SCHEDULE_WINDOW on invalid format', () => {
        expect(() => parseTimeToSeconds('25:00')).toThrowError(AppError);
        try {
          parseTimeToSeconds('25:00');
        } catch (err: any) {
          expect(err.statusCode).toBe(422);
          expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
        }
      });
    });

    describe('Window validation (startTime < endTime)', () => {
      it('passes when startTime < endTime', () => {
        expect(() => validateTimeWindow('09:00', '12:00')).not.toThrow();
        expect(() => validateTimeWindow('09:00:00', '12:00:00')).not.toThrow();
        expect(() => validateTimeWindow('00:00', '23:59')).not.toThrow();
      });

      it('rejects with 422 INVALID_SCHEDULE_WINDOW when startTime >= endTime (e.g. 14:00–10:00 or 10:00–10:00)', () => {
        expect(() => validateTimeWindow('14:00', '10:00')).toThrowError(AppError);
        try {
          validateTimeWindow('14:00', '10:00');
        } catch (err: any) {
          expect(err.statusCode).toBe(422);
          expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
        }

        try {
          validateTimeWindow('10:00', '10:00');
        } catch (err: any) {
          expect(err.statusCode).toBe(422);
          expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
        }
      });
    });

    describe('Shift overlap detection (strict overlap vs back-to-back)', () => {
      it('permits back-to-back shifts: 09:00–12:00 and 12:00–15:00 do not overlap (returns false)', () => {
        const shift1 = { startTime: '09:00', endTime: '12:00' };
        const shift2 = { startTime: '12:00', endTime: '15:00' };
        expect(doShiftsOverlap(shift1, shift2)).toBe(false);
        expect(doShiftsOverlap(shift2, shift1)).toBe(false);
      });

      it('detects strict overlap: 09:00–13:00 and 12:00–16:00 overlap (returns true)', () => {
        const shift1 = { startTime: '09:00', endTime: '13:00' };
        const shift2 = { startTime: '12:00', endTime: '16:00' };
        expect(doShiftsOverlap(shift1, shift2)).toBe(true);
        expect(doShiftsOverlap(shift2, shift1)).toBe(true);
      });

      it('detects containment overlap: 09:00–17:00 and 10:00–14:00 overlap (returns true)', () => {
        const shift1 = { startTime: '09:00', endTime: '17:00' };
        const shift2 = { startTime: '10:00', endTime: '14:00' };
        expect(doShiftsOverlap(shift1, shift2)).toBe(true);
        expect(doShiftsOverlap(shift2, shift1)).toBe(true);
      });

      it('detects identical shift overlap: 09:00–12:00 and 09:00–12:00 overlap (returns true)', () => {
        const shift1 = { startTime: '09:00', endTime: '12:00' };
        const shift2 = { startTime: '09:00', endTime: '12:00' };
        expect(doShiftsOverlap(shift1, shift2)).toBe(true);
      });
    });

    describe('Multi-shift array validation (validateShifts)', () => {
      it('allows split shifts and back-to-back shifts across days', () => {
        const validShifts = [
          { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
          { dayOfWeek: 1, startTime: '12:00', endTime: '15:00', isActive: true },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
        ];
        expect(() => validateShifts(validShifts)).not.toThrow();
      });

      it('rejects overlapping shifts on the same day with 422 INVALID_SCHEDULE_WINDOW', () => {
        const overlappingShifts = [
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', isActive: true },
          { dayOfWeek: 1, startTime: '12:00', endTime: '16:00', isActive: true },
        ];
        try {
          validateShifts(overlappingShifts);
          expect.fail('Should have thrown AppError 422');
        } catch (err: any) {
          expect(err.statusCode).toBe(422);
          expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
        }
      });

      it('rejects inverted shift with 422 INVALID_SCHEDULE_WINDOW', () => {
        const invertedShifts = [
          { dayOfWeek: 1, startTime: '14:00', endTime: '10:00', isActive: true },
        ];
        try {
          validateShifts(invertedShifts);
          expect.fail('Should have thrown AppError 422');
        } catch (err: any) {
          expect(err.statusCode).toBe(422);
          expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
        }
      });
    });

    describe('Exception validation (validateException)', () => {
      it('accepts full-day HOLIDAY exception with null startTime and endTime', () => {
        expect(() =>
          validateException({
            exceptionDate: '2026-12-25',
            exceptionType: 'HOLIDAY',
            startTime: null,
            endTime: null,
            reason: 'Christmas Holiday',
          })
        ).not.toThrow();
      });

      it('accepts partial-day exception with valid time window', () => {
        expect(() =>
          validateException({
            exceptionDate: '2026-12-26',
            exceptionType: 'BREAK',
            startTime: '12:00',
            endTime: '14:00',
            reason: 'Doctor Seminar',
          })
        ).not.toThrow();
      });

      it('rejects partial-day exception with inverted time window (422 INVALID_SCHEDULE_WINDOW)', () => {
        try {
          validateException({
            exceptionDate: '2026-12-26',
            exceptionType: 'BREAK',
            startTime: '14:00',
            endTime: '12:00',
          });
          expect.fail('Should have thrown 422');
        } catch (err: any) {
          expect(err.statusCode).toBe(422);
          expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
        }
      });

      it('rejects partial-day exception when only startTime is provided', () => {
        try {
          validateException({
            exceptionDate: '2026-12-26',
            exceptionType: 'BREAK',
            startTime: '12:00',
            endTime: null,
          });
          expect.fail('Should have thrown 422');
        } catch (err: any) {
          expect(err.statusCode).toBe(422);
          expect(err.code).toBe('INVALID_SCHEDULE_WINDOW');
        }
      });
    });
  });

  // ============================================================================
  // 2. AC-F006-01 / STS-S1-008 (Positive — Split Shifts & Persistence)
  // ============================================================================
  describe('2. AC-F006-01 / STS-S1-008 (Positive — Split Shifts & Persistence)', () => {
    it('The logged-in doctor saves Monday shifts from 09:00–12:00 and 13:00–17:00 via PUT /api/v1/doctors/me/schedule (200 OK) -> Calls GET /api/v1/doctors/me/schedule again to verify that the data is persistently saved in the DB', async () => {
      const payload = {
        shifts: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
          { dayOfWeek: 1, startTime: '13:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 2, startTime: '09:00', endTime: '12:00', isActive: true },
          { dayOfWeek: 2, startTime: '13:00', endTime: '17:00', isActive: true },
        ],
      };

      // Step A: PUT /api/v1/doctors/me/schedule
      const putRes = await request(app)
        .put('/api/v1/doctors/me/schedule')
        .set('Cookie', doctorCookies)
        .send(payload);

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.data.weeklySchedules).toHaveLength(4);

      // Step B: GET /api/v1/doctors/me/schedule retrieves the saved shifts
      const getRes = await request(app)
        .get('/api/v1/doctors/me/schedule')
        .set('Cookie', doctorCookies);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.weeklySchedules).toHaveLength(4);

      const mondayShifts = getRes.body.data.weeklySchedules.filter((s: any) => s.dayOfWeek === 1);
      expect(mondayShifts).toHaveLength(2);
      expect(mondayShifts[0].startTime).toBe('09:00');
      expect(mondayShifts[0].endTime).toBe('12:00');
      expect(mondayShifts[1].startTime).toBe('13:00');
      expect(mondayShifts[1].endTime).toBe('17:00');

      // Verify direct PostgreSQL persistence
      const dbSchedules = await prisma.doctorSchedule.findMany({
        where: { doctorId: primaryDoctorId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
      expect(dbSchedules).toHaveLength(4);
      expect(dbSchedules[0].dayOfWeek).toBe(1);
      expect(dbSchedules[0].startTime).toBe('09:00');
      expect(dbSchedules[0].endTime).toBe('12:00');
      expect(dbSchedules[1].dayOfWeek).toBe(1);
      expect(dbSchedules[1].startTime).toBe('13:00');
      expect(dbSchedules[1].endTime).toBe('17:00');
    });

    it('Doctor submits schedules using { schedules: [{ dayOfWeek, startTime, endTime }] } format, persists immediately (200 OK), and GET retrieves sorted weeklySchedules (dayOfWeek 0–6 and startTime)', async () => {
      const payload = {
        schedules: [
          { dayOfWeek: 5, startTime: '13:00', endTime: '16:00' },
          { dayOfWeek: 1, startTime: '08:30', endTime: '11:30' },
          { dayOfWeek: 1, startTime: '13:00', endTime: '17:00' },
          { dayOfWeek: 3, startTime: '09:00', endTime: '12:00' },
        ],
      };

      const putRes = await request(app)
        .put('/api/v1/doctors/me/schedule')
        .set('Cookie', doctorCookies)
        .send(payload);

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.data.weeklySchedules).toHaveLength(4);

      // Verify GET returns sorted by dayOfWeek 0-6 then startTime
      const getRes = await request(app)
        .get('/api/v1/doctors/me/schedule')
        .set('Cookie', doctorCookies);

      expect(getRes.status).toBe(200);
      const returnedSchedules = getRes.body.data.weeklySchedules;
      expect(returnedSchedules).toHaveLength(4);

      // Day 1 shifts should come first, ordered by startTime
      expect(returnedSchedules[0].dayOfWeek).toBe(1);
      expect(returnedSchedules[0].startTime).toBe('08:30');
      expect(returnedSchedules[1].dayOfWeek).toBe(1);
      expect(returnedSchedules[1].startTime).toBe('13:00');

      // Day 3 shift next
      expect(returnedSchedules[2].dayOfWeek).toBe(3);
      expect(returnedSchedules[2].startTime).toBe('09:00');

      // Day 5 shift last
      expect(returnedSchedules[3].dayOfWeek).toBe(5);
      expect(returnedSchedules[3].startTime).toBe('13:00');
    });
  });

  // ============================================================================
  // 3. AC-F006-02 / STS-S1-008 (Negative — Overlapping & Invalid Windows + Ownership/RBAC)
  // ============================================================================
  describe('3. AC-F006-02 / STS-S1-008 (Negative — Overlapping & Invalid Windows + Ownership/RBAC)', () => {
    it('submitting overlapping shifts on the same day (09:00–13:00 and 12:00–16:00) is rejected with 422 Unprocessable Entity (error.code === "INVALID_SCHEDULE_WINDOW")', async () => {
      const payload = {
        shifts: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', isActive: true },
          { dayOfWeek: 1, startTime: '12:00', endTime: '16:00', isActive: true },
        ],
      };

      const res = await request(app)
        .put('/api/v1/doctors/me/schedule')
        .set('Cookie', doctorCookies)
        .send(payload);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('INVALID_SCHEDULE_WINDOW');
      expect(res.body.error.message).toMatch(/overlap/i);

      // Verify existing schedules remain unaltered
      const existingShifts = await prisma.doctorSchedule.findMany({
        where: { doctorId: primaryDoctorId },
      });
      expect(existingShifts).toHaveLength(4);
    });

    it('submitting an invalid time window (14:00–10:00) is rejected with 422 Unprocessable Entity (error.code === "INVALID_SCHEDULE_WINDOW")', async () => {
      const payload = {
        shifts: [
          { dayOfWeek: 1, startTime: '14:00', endTime: '10:00', isActive: true },
        ],
      };

      const res = await request(app)
        .put('/api/v1/doctors/me/schedule')
        .set('Cookie', doctorCookies)
        .send(payload);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('INVALID_SCHEDULE_WINDOW');
      expect(res.body.error.message).toMatch(/start time.*earlier than end time|before end time/i);

      // Verify existing schedules remain unaltered
      const existingShifts = await prisma.doctorSchedule.findMany({
        where: { doctorId: primaryDoctorId },
      });
      expect(existingShifts).toHaveLength(4);
    });

    it('submitting invalid time formats (e.g. 25:00–12:00) is rejected with 422 Unprocessable Entity (code: INVALID_SCHEDULE_WINDOW)', async () => {
      const payload = {
        shifts: [
          { dayOfWeek: 1, startTime: '25:00', endTime: '12:00', isActive: true },
        ],
      };

      const res = await request(app)
        .put('/api/v1/doctors/me/schedule')
        .set('Cookie', doctorCookies)
        .send(payload);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_SCHEDULE_WINDOW');
    });

    it('Doctor B attempting to delete Doctor A\'s exception via DELETE /api/v1/doctors/me/exceptions/:exceptionId is rejected with 404 Not Found', async () => {
      // Step A: Primary Doctor (Doctor A) creates an exception
      const createRes = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({
          exceptionDate: '2026-12-28',
          exceptionType: 'BREAK',
          startTime: '13:00',
          endTime: '15:00',
          reason: 'Doctor A Personal Break',
        });
      expect(createRes.status).toBe(201);
      const docAExId = createRes.body.data.exceptionId;
      createdExceptionIds.push(docAExId);

      // Step B: Doctor B (secondDoctorCookies) attempts to delete Doctor A's exception
      const deleteRes = await request(app)
        .delete(`/api/v1/doctors/me/exceptions/${docAExId}`)
        .set('Cookie', secondDoctorCookies);

      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body.success).toBe(false);
      expect(deleteRes.body.error.code).toBe('EXCEPTION_NOT_FOUND');

      // Verify the exception was NOT deleted and still exists in DB
      const inDb = await prisma.scheduleException.findUnique({
        where: { exceptionId: docAExId },
      });
      expect(inDb).not.toBeNull();
      expect(inDb?.doctorId).toBe(primaryDoctorId);
    });

    it('A PATIENT attempting to call /api/v1/doctors/me/schedule is rejected with 403 Forbidden', async () => {
      // Patient attempting PUT /api/v1/doctors/me/schedule
      const putRes = await request(app)
        .put('/api/v1/doctors/me/schedule')
        .set('Cookie', patientCookies)
        .send({
          shifts: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
        });
      expect(putRes.status).toBe(403);
      expect(putRes.body.success).toBe(false);

      // Patient attempting GET /api/v1/doctors/me/schedule
      const getRes = await request(app)
        .get('/api/v1/doctors/me/schedule')
        .set('Cookie', patientCookies);
      expect(getRes.status).toBe(403);
      expect(getRes.body.success).toBe(false);
    });

    it('Unauthenticated client calling /api/v1/doctors/me/schedule is rejected with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/doctors/me/schedule');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================================
  // 4. AC-F006-03 / STS-S1-008 (Boundary — Adjacent Shifts & Full-Day Holiday)
  // ============================================================================
  describe('4. AC-F006-03 / STS-S1-008 (Boundary — Adjacent Shifts & Full-Day Holiday)', () => {
    it('submitting back-to-back adjacent shifts (09:00–12:00 and 12:00–15:00) succeeds (200 OK)', async () => {
      const payload = {
        shifts: [
          { dayOfWeek: 3, startTime: '09:00', endTime: '12:00', isActive: true },
          { dayOfWeek: 3, startTime: '12:00', endTime: '15:00', isActive: true },
        ],
      };

      const res = await request(app)
        .put('/api/v1/doctors/me/schedule')
        .set('Cookie', doctorCookies)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.weeklySchedules).toHaveLength(2);
      expect(res.body.data.weeklySchedules[0].startTime).toBe('09:00');
      expect(res.body.data.weeklySchedules[0].endTime).toBe('12:00');
      expect(res.body.data.weeklySchedules[1].startTime).toBe('12:00');
      expect(res.body.data.weeklySchedules[1].endTime).toBe('15:00');
    });

    it('adding a full-day HOLIDAY exception by sending startTime: null, endTime: null via POST /api/v1/doctors/me/exceptions succeeds (201 Created)', async () => {
      const payload = {
        exceptionDate: '2026-12-25',
        exceptionType: 'HOLIDAY',
        startTime: null,
        endTime: null,
        reason: 'Christmas Holiday',
      };

      const res = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exceptionId).toBeDefined();
      expect(res.body.data.exceptionType).toBe('HOLIDAY');
      expect(res.body.data.startTime).toBeNull();
      expect(res.body.data.endTime).toBeNull();
      expect(res.body.data.reason).toBe(payload.reason);

      createdExceptionIds.push(res.body.data.exceptionId);

      // Verify in GET /api/v1/doctors/me/schedule
      const getRes = await request(app)
        .get('/api/v1/doctors/me/schedule')
        .set('Cookie', doctorCookies);

      expect(getRes.status).toBe(200);
      const matched = getRes.body.data.exceptions.find(
        (e: any) => e.exceptionId === res.body.data.exceptionId
      );
      expect(matched).toBeDefined();
      expect(matched.exceptionType).toBe('HOLIDAY');
      expect(matched.startTime).toBeNull();
      expect(matched.endTime).toBeNull();
    });

    it('doctor successfully deletes own exception via DELETE /api/v1/doctors/me/exceptions/:exceptionId (200 OK)', async () => {
      // Create a temporary exception
      const createRes = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({
          exceptionDate: '2026-12-31',
          exceptionType: 'UNAVAILABLE',
          reason: 'New Year Eve Leave',
        });
      expect(createRes.status).toBe(201);
      const exId = createRes.body.data.exceptionId;

      // Delete own exception
      const deleteRes = await request(app)
        .delete(`/api/v1/doctors/me/exceptions/${exId}`)
        .set('Cookie', doctorCookies);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Confirm deleted from DB
      const inDb = await prisma.scheduleException.findUnique({
        where: { exceptionId: exId },
      });
      expect(inDb).toBeNull();
    });
  });

  // ============================================================================
  // 5. Admin Schedule Governance (AC-F007-01 / F-007)
  // ============================================================================
  describe('5. Admin Schedule Governance & Overrides (F-007, AC-F007-01)', () => {
    it('Admin retrieves doctor schedule via GET /api/v1/admin/doctors/:doctorId/schedule', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/doctors/${primaryDoctorId}/schedule`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.doctorId).toBe(primaryDoctorId);
      expect(res.body.data.weeklySchedules).toBeDefined();
    });

    it('Admin overrides doctor schedule via PUT /api/v1/admin/doctors/:doctorId/schedule and records an AuditLog entry', async () => {
      const payload = {
        shifts: [
          { dayOfWeek: 4, startTime: '08:00', endTime: '12:00', isActive: true },
          { dayOfWeek: 4, startTime: '13:00', endTime: '16:00', isActive: true },
        ],
        reason: 'Clinic special operating hours',
      };

      const res = await request(app)
        .put(`/api/v1/admin/doctors/${primaryDoctorId}/schedule`)
        .set('Cookie', adminCookies)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.weeklySchedules).toHaveLength(2);

      // Verify AuditLog record exists
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          actionType: 'ADMIN_SCHEDULE_UPDATE',
          entityId: primaryDoctorId,
          userId: adminUserId,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.actionType).toBe('ADMIN_SCHEDULE_UPDATE');
    });

    it('Admin creates an exception for a doctor via POST /api/v1/admin/doctors/:doctorId/exceptions and records an AuditLog entry', async () => {
      const payload = {
        exceptionDate: '2026-12-24',
        exceptionType: 'BREAK',
        startTime: '14:00',
        endTime: '16:00',
        reason: 'Admin approved staff meeting',
      };

      const res = await request(app)
        .post(`/api/v1/admin/doctors/${primaryDoctorId}/exceptions`)
        .set('Cookie', adminCookies)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exceptionId).toBeDefined();
      createdExceptionIds.push(res.body.data.exceptionId);

      // Verify AuditLog record
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          actionType: 'ADMIN_SCHEDULE_EXCEPTION_CREATED',
          entityId: res.body.data.exceptionId,
          userId: adminUserId,
        },
      });
      expect(auditLog).toBeDefined();
    });

    it('Doctor calling PUT /api/v1/admin/doctors/:doctorId/schedule receives 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/doctors/${primaryDoctorId}/schedule`)
        .set('Cookie', doctorCookies)
        .send({
          shifts: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
        });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
