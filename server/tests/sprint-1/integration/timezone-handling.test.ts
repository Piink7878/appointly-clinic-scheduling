// ==============================================================================
// Appointly Server — Timezone & Calendar-Date Handling (UTC storage, Asia/Bangkok clinic)
// ==============================================================================
// Reference: System-Level SDS Sections 3.1, 5.1 & 8.2 (DEC-016); Sprint 1 Contracts
//            Section 1.6 (exceptionDate is a calendar DATE)
// - every timestamp column is TIMESTAMPTZ (stored as UTC)
// - API timestamps are ISO 8601 UTC ("…Z")
// - a calendar date supplied as a timestamp resolves to the CLINIC-LOCAL day, and an
//   impossible date is rejected instead of silently rolling over
//   (the pure conversion logic is unit-tested in unit/timezone.test.ts)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';
import { prisma } from '../../../src/shared/database';
import { cookiesOf } from '../../helpers';

describe('Timezone & calendar-date handling', () => {
  let adminCookies: string[];
  let doctorId: string;
  const createdExceptionIds: string[] = [];

  beforeAll(async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@appointly.local', password: 'ChangeMe123!' });
    adminCookies = cookiesOf(login);
    const doctor = await prisma.doctor.findFirstOrThrow({ where: { user: { email: 'doctor@appointly.local' } } });
    doctorId = doctor.doctorId;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: createdExceptionIds } } });
    await prisma.scheduleException.deleteMany({ where: { exceptionId: { in: createdExceptionIds } } });
  });

  describe('database schema', () => {
    it('every *_at column is TIMESTAMPTZ, so instants are stored in UTC', async () => {
      const rows = await prisma.$queryRaw<{ table_name: string; column_name: string; data_type: string }[]>`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name LIKE '%\_at'
      `;
      expect(rows.length).toBeGreaterThan(10);
      const wrong = rows.filter((r) => r.data_type !== 'timestamp with time zone');
      expect(wrong).toEqual([]);
    });

    it('calendar-only values are DATE columns (no hidden time-of-day to shift across timezones)', async () => {
      const rows = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name IN ('date_of_birth', 'exception_date')
      `;
      expect(rows.map((r) => r.column_name).sort()).toEqual(['date_of_birth', 'exception_date']);
      expect(rows.every((r) => r.data_type === 'date')).toBe(true);
    });
  });

  describe('API output', () => {
    it('timestamps are ISO 8601 UTC strings ending in Z', async () => {
      const res = await request(app).get('/api/v1/doctors').set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const d of res.body.data) {
        expect(d.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(d.updatedAt).toMatch(/Z$/);
      }
    });
  });

  describe('POST /admin/doctors/:id/exceptions stores the clinic-local calendar day', () => {
    const storedDate = async (exceptionId: string) => {
      const rows = await prisma.$queryRaw<{ d: string }[]>`
        SELECT exception_date::text AS d FROM schedule_exceptions WHERE exception_id = ${exceptionId}::uuid
      `;
      return rows[0]?.d;
    };

    it.each([
      ['2099-12-25', '2099-12-25'],
      ['2099-12-25T01:00:00+07:00', '2099-12-25'],
      ['2099-12-24T18:00:00.000Z', '2099-12-25'],
      ['2099-12-25T20:00:00Z', '2099-12-26'],
    ])('exceptionDate %s is stored as %s', async (sent, expected) => {
      const res = await request(app)
        .post(`/api/v1/admin/doctors/${doctorId}/exceptions`)
        .set('Cookie', adminCookies)
        .send({ exceptionDate: sent, exceptionType: 'HOLIDAY', reason: 'timezone test' });
      expect(res.status).toBe(201);
      createdExceptionIds.push(res.body.data.exceptionId);
      expect(await storedDate(res.body.data.exceptionId)).toBe(expected);
    });

    it.each(['2099-02-30', '2099-13-01', '2099-04-31', 'not-a-date', ''])(
      'an impossible date %j is a 400, not a different day',
      async (sent) => {
        const before = await prisma.scheduleException.count({ where: { doctorId } });
        const res = await request(app)
          .post(`/api/v1/admin/doctors/${doctorId}/exceptions`)
          .set('Cookie', adminCookies)
          .send({ exceptionDate: sent, exceptionType: 'HOLIDAY' });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(await prisma.scheduleException.count({ where: { doctorId } })).toBe(before);
      }
    );
  });
});
