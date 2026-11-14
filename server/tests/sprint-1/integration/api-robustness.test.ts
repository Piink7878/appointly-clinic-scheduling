// ==============================================================================
// Appointly Server — API Robustness & Envelope Consistency (F-001 … F-007)
// ==============================================================================
// Reference: System-Level SDS Section 5.3 (standard envelopes); Sprint 1
//            Contracts AC-F002-03, AC-F003-03, AC-F004-03, AC-F007-03
// Malformed input must never surface as a 500, and every JSON response must use
//   { success: true,  data, message }   or   { success: false, error: { code, message } }
// ==============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';
import { prisma } from '../../../src/shared/database';

import { cookiesOf } from '../../helpers';
type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';

const UUID = '00000000-0000-4000-8000-000000000000';
// A valid UUID padded with whitespace must be rejected as a whole, not trimmed for the check and then sent to the database as-is.
const BAD_IDS = [` ${UUID} `, `${UUID}%20`, 'not-a-uuid', '123', 'x'.repeat(300), '%00', '..%2F..%2Fetc%2Fpasswd', "'; DROP TABLE users;--", 'null', 'undefined'];

/** Asserts the SDS §5.3 envelope for a JSON response. */
function expectEnvelope(res: request.Response, label: string) {
  expect(res.type, `${label} content-type`).toContain('json');
  expect(typeof res.body.success, `${label} success flag`).toBe('boolean');
  if (res.body.success) {
    expect(res.body, `${label} success envelope`).toHaveProperty('data');
    expect(typeof res.body.message, `${label} message`).toBe('string');
    // SDS §5.3: exactly { success, data, message } — payload fields are never duplicated at the top level.
    expect(Object.keys(res.body).sort(), `${label} top-level keys`).toEqual(['data', 'message', 'success']);
  } else {
    expect(typeof res.body.error?.code, `${label} error.code`).toBe('string');
    expect(typeof res.body.error?.message, `${label} error.message`).toBe('string');
    expect(Object.keys(res.body).sort(), `${label} top-level keys`).toEqual(['error', 'success']);
    expect(Object.keys(res.body.error).sort(), `${label} error keys`).toEqual(['code', 'message']);
  }
}

describe('API robustness & envelope consistency', () => {
  const cookies: Record<Role, string[]> = { PATIENT: [], DOCTOR: [], ADMIN: [] };
  const as = (role: Role) => ({ Cookie: cookies[role] });

  beforeAll(async () => {
    const accounts: Record<Role, string> = {
      PATIENT: 'patient.arisa@appointly.local',
      DOCTOR: 'doctor@appointly.local',
      ADMIN: 'admin@appointly.local',
    };
    for (const role of Object.keys(accounts) as Role[]) {
      const res = await request(app).post('/api/v1/auth/login').send({ email: accounts[role], password: 'ChangeMe123!' });
      cookies[role] = cookiesOf(res);
    }
  });

  // --------------------------------------------------------------------------
  describe('malformed identifiers never cause a 500 and answer with the error envelope', () => {
    const idRoutes: [Role, string, (id: string) => string, object?][] = [
      ['ADMIN', 'GET', (id) => `/admin/doctors/${id}/schedule`],
      ['ADMIN', 'PUT', (id) => `/admin/doctors/${id}/schedule`, { shifts: [] }],
      ['ADMIN', 'GET', (id) => `/admin/doctors/${id}/exceptions`],
      ['ADMIN', 'POST', (id) => `/admin/doctors/${id}/exceptions`, { exceptionDate: '2099-01-01', exceptionType: 'HOLIDAY' }],
      ['ADMIN', 'DELETE', (id) => `/admin/doctors/${id}/exceptions/${id}`],
      ['ADMIN', 'PUT', (id) => `/admin/doctors/${id}`, { fullName: 'x', specialization: 'y' }],
      ['ADMIN', 'PATCH', (id) => `/admin/doctors/${id}/status`, { profileStatus: 'ACTIVE' }],
      ['ADMIN', 'POST', (id) => `/admin/doctors/${id}/services`, { serviceId: UUID }],
      ['ADMIN', 'DELETE', (id) => `/admin/doctors/${id}/services/${id}`],
      ['ADMIN', 'GET', (id) => `/admin/services/${id}`],
      ['ADMIN', 'PUT', (id) => `/admin/services/${id}`, { serviceName: 'x', durationMinutes: 10 }],
      ['ADMIN', 'PATCH', (id) => `/admin/services/${id}/status`, { serviceStatus: 'ACTIVE' }],
      ['ADMIN', 'GET', (id) => `/doctors/${id}`],
      ['ADMIN', 'GET', (id) => `/doctors/${id}/schedule`],
      ['PATIENT', 'GET', (id) => `/doctors/${id}`],
      ['PATIENT', 'GET', (id) => `/services/${id}`],
      ['DOCTOR', 'DELETE', (id) => `/doctors/me/exceptions/${id}`],
    ];

    for (const [role, method, build, body] of idRoutes) {
      it(`${role} ${method} ${build(':id')}`, async () => {
        for (const id of BAD_IDS) {
          const label = `${role} ${method} ${build(id)}`;
          const res = await (request(app) as any)[method.toLowerCase()](`/api/v1${build(id)}`)
            .set(as(role))
            .send(body ?? {});
          expect(res.status, label).toBeLessThan(500);
          expect(res.status, label).toBeGreaterThanOrEqual(400);
          expectEnvelope(res, label);
        }
      });
    }
  });

  // --------------------------------------------------------------------------
  describe('odd query strings on list endpoints', () => {
    const queries: [Role, string][] = [
      ['ADMIN', '/admin/patients?page=-1'],
      ['ADMIN', '/admin/patients?page=abc&limit=xyz'],
      ['ADMIN', '/admin/patients?page=0&limit=0'],
      ['ADMIN', '/admin/patients?limit=1000000'],
      ['ADMIN', '/admin/patients?page=99999999999999999999'],
      ['ADMIN', "/admin/patients?search=%27%3B%20DROP%20TABLE%20patients%3B--"],
      ['ADMIN', `/admin/patients?search=${'a'.repeat(5000)}`],
      ['ADMIN', '/admin/patients?search[]=a&search[]=b'],
      ['ADMIN', '/doctors?status=bogus'],
      ['ADMIN', '/doctors?status[]=ACTIVE'],
      ['ADMIN', `/doctors?serviceId=${'z'.repeat(500)}`],
      ['ADMIN', `/doctors?search=${'%'.repeat(2000)}`],
      ['PATIENT', '/doctors?serviceId=not-a-uuid'],
      ['PATIENT', '/doctors?serviceId[]=a'],
      ['ADMIN', '/services?status=bogus'],
      ['ADMIN', '/services?search[]=a'],
      ['PATIENT', `/services?search=${'q'.repeat(5000)}`],
    ];

    it.each(queries)('%s GET %s', async (role, url) => {
      const res = await request(app).get(`/api/v1${url}`).set(as(role));
      expect(res.status, url).toBeLessThan(500);
      expectEnvelope(res, url);
    });
  });

  // --------------------------------------------------------------------------
  describe('malformed or hostile request bodies', () => {
    const wrongBodies: [Role, string, string, unknown][] = [
      ['PATIENT', 'PUT', '/patients/me', { fullName: 123, phoneNumber: {}, dateOfBirth: [] }],
      ['PATIENT', 'PUT', '/patients/me', []],
      ['PATIENT', 'PUT', '/patients/me', { fullName: 'x'.repeat(100000), phoneNumber: '0812345678' }],
      ['ADMIN', 'POST', '/admin/doctors', { email: 5, password: null, fullName: [], specialization: {} }],
      ['ADMIN', 'POST', '/admin/doctors', []],
      ['ADMIN', 'PUT', `/admin/doctors/${UUID}`, { fullName: null, specialization: 5 }],
      ['ADMIN', 'PATCH', `/admin/doctors/${UUID}/status`, { profileStatus: ['ACTIVE'] }],
      ['ADMIN', 'POST', `/admin/doctors/${UUID}/services`, { serviceId: 42 }],
      ['ADMIN', 'POST', `/admin/doctors/${UUID}/services`, { serviceIds: 'abc' }],
      ['ADMIN', 'POST', '/admin/services', { serviceName: 7, durationMinutes: 'abc' }],
      ['ADMIN', 'POST', '/admin/services', { serviceName: 'ok', durationMinutes: {} }],
      ['ADMIN', 'POST', '/admin/services', { serviceName: 'ok', durationMinutes: 1e300 }],
      ['ADMIN', 'POST', '/admin/services', { serviceName: 'ok', durationMinutes: 2147483648 }],
      ['ADMIN', 'POST', '/admin/services', { serviceName: 'ok', description: 'd'.repeat(10000), durationMinutes: 10 }],
      ['ADMIN', 'PATCH', `/admin/services/${UUID}/status`, { serviceStatus: 5 }],
      ['ADMIN', 'PUT', `/admin/doctors/${UUID}/schedule`, { shifts: 'nope' }],
      ['ADMIN', 'PUT', `/admin/doctors/${UUID}/schedule`, { shifts: [{ dayOfWeek: '1', startTime: 9, endTime: null }] }],
      ['ADMIN', 'PUT', `/admin/doctors/${UUID}/schedule`, { shifts: [{ dayOfWeek: 99, startTime: '09:00', endTime: '10:00' }] }],
      ['ADMIN', 'POST', `/admin/doctors/${UUID}/exceptions`, { exceptionDate: 'not-a-date', exceptionType: 'HOLIDAY' }],
      ['ADMIN', 'POST', `/admin/doctors/${UUID}/exceptions`, { exceptionDate: '2099-01-01', exceptionType: 'NOPE' }],
      ['ADMIN', 'POST', `/admin/doctors/${UUID}/exceptions`, { exceptionDate: '99999-01-01', exceptionType: 'HOLIDAY' }],
      ['DOCTOR', 'PUT', '/doctors/me/schedule', { shifts: [{ dayOfWeek: 1, startTime: '9am', endTime: '5pm' }] }],
      ['DOCTOR', 'PUT', '/doctors/me/schedule', 'just a string'],
      ['DOCTOR', 'POST', '/doctors/me/exceptions', { exceptionDate: 20260101, exceptionType: 'HOLIDAY' }],
      ['DOCTOR', 'POST', '/doctors/me/exceptions', { exceptionDate: '2099-01-01', exceptionType: 'BREAK', startTime: 5, endTime: 6 }],
      ['ADMIN', 'PATCH', '/admin/settings', { fixedStartIntervalMinutes: 'abc', cancellationCutoffHours: {} }],
      ['ADMIN', 'PATCH', '/admin/settings', { clinicName: 5, timezone: [] }],
      ['ADMIN', 'PATCH', '/admin/settings', { cancellationCutoffHours: 1e300 }],
      ['ADMIN', 'PATCH', '/admin/settings', { reminderLeadHours: -5 }],
      ['ADMIN', 'PATCH', '/admin/settings', []],
    ];

    it.each(wrongBodies)('%s %s %s with %j', async (role, method, url, body) => {
      const label = `${role} ${method} ${url} ${JSON.stringify(body).slice(0, 60)}`;
      const res = await (request(app) as any)[method.toLowerCase()](`/api/v1${url}`).set(as(role)).send(body);
      expect(res.status, label).toBeLessThan(500);
      expect(res.status, label).toBeGreaterThanOrEqual(400);
      expectEnvelope(res, label);
    });

    it('login with wrong types is a 400/401, never a 500', async () => {
      for (const body of [{ email: 5, password: {} }, { email: 'a@b.co' }, {}, [], { email: 'a'.repeat(5000), password: 'x' }]) {
        const res = await request(app).post('/api/v1/auth/login').send(body as object);
        expect([400, 401], JSON.stringify(body).slice(0, 50)).toContain(res.status);
        expectEnvelope(res, 'login');
      }
    });

    it('syntactically broken JSON is a 400 INVALID_JSON envelope', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "a@b.co", "password": ');
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, error: { code: 'INVALID_JSON' } });
    });

    it('an oversized body is a 413 envelope, not a 500', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(2_000_000) }));
      expect(res.status).toBe(413);
      expect(res.body).toMatchObject({ success: false, error: { code: 'PAYLOAD_TOO_LARGE' } });
    });

    it('an unsupported charset / body encoding is a 4xx envelope, not a 500', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json; charset=utf-16')
        .send('{"email":"a@b.co","password":"x"}');
      expect(res.status).toBeLessThan(500);
      expectEnvelope(res, 'charset');
    });
  });

  // --------------------------------------------------------------------------
  describe('unknown routes and methods', () => {
    it.each([
      ['GET', '/api/v1/does-not-exist'],
      ['POST', '/api/v1/doctors/me/nope'],
      ['DELETE', '/api/v1/services'],
      ['GET', '/api/does-not-exist'],
    ])('%s %s returns a 404 error envelope (not an HTML page)', async (method, url) => {
      const res = await (request(app) as any)[method.toLowerCase()](url).set(as('ADMIN'));
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    });

    it('an unauthenticated unknown API path is also a 404 envelope (nothing to protect)', async () => {
      const res = await request(app).get('/api/v1/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  describe('envelope on representative successful responses', () => {
    it.each([
      ['ADMIN', '/admin/patients'],
      ['ADMIN', '/admin/doctors'],
      ['ADMIN', '/admin/services'],
      ['ADMIN', '/admin/settings'],
      ['ADMIN', '/admin/dashboard'],
      ['PATIENT', '/patients/me'],
      ['PATIENT', '/doctors'],
      ['PATIENT', '/services'],
      ['DOCTOR', '/doctors/me/schedule'],
      ['DOCTOR', '/doctors/me/exceptions'],
      ['PATIENT', '/auth/me'],
      ['PATIENT', '/settings/public'],
    ])('%s GET %s', async (role, url) => {
      const res = await request(app).get(`/api/v1${url}`).set(as(role as Role));
      expect(res.status, url).toBe(200);
      expectEnvelope(res, url);
    });

    it('login, refresh and the mutating endpoints answer with exactly the success envelope', async () => {
      const login = await request(app).post('/api/v1/auth/login').send({ email: 'patient@appointly.local', password: 'ChangeMe123!' });
      expect(login.status).toBe(200);
      expectEnvelope(login, 'login');

      const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', login.headers['set-cookie']);
      expect(refresh.status).toBe(200);
      expectEnvelope(refresh, 'refresh');

      const profile = await request(app).get('/api/v1/patients/me').set('Cookie', cookies.PATIENT);
      const put = await request(app)
        .put('/api/v1/patients/me')
        .set('Cookie', cookies.PATIENT)
        .send({ fullName: profile.body.data.fullName, phoneNumber: profile.body.data.phoneNumber });
      expect(put.status).toBe(200);
      expectEnvelope(put, 'PUT /patients/me');

      const noop = await request(app).patch('/api/v1/admin/settings').set('Cookie', cookies.ADMIN).send({});
      expect(noop.status).toBe(200);
      expectEnvelope(noop, 'PATCH /admin/settings');
    });

    it('logout answers with the success envelope', async () => {
      const login = await request(app).post('/api/v1/auth/login').send({ email: 'patient@appointly.local', password: 'ChangeMe123!' });
      const res = await request(app).post('/api/v1/auth/logout').set('Cookie', cookiesOf(login));
      expect(res.status).toBe(200);
      expectEnvelope(res, 'logout');
    });
  });

  // --------------------------------------------------------------------------
  describe('zero is a value, never "missing"', () => {
    it('a Sunday (dayOfWeek 0) shift starting at midnight (00:00) is accepted and stored as given', async () => {
      const doctor = await prisma.doctor.findFirstOrThrow({ where: { user: { email: 'doctor@appointly.local' } } });
      const original = await prisma.doctorSchedule.findMany({ where: { doctorId: doctor.doctorId } });
      try {
        const res = await request(app)
          .put(`/api/v1/admin/doctors/${doctor.doctorId}/schedule`)
          .set(as('ADMIN'))
          .send({ shifts: [{ dayOfWeek: 0, startTime: '00:00', endTime: '01:00', isActive: true }], reason: 'zero test' });
        expect(res.status).toBe(200);
        expect(res.body.data.weeklySchedules).toHaveLength(1);
        expect(res.body.data.weeklySchedules[0]).toMatchObject({ dayOfWeek: 0, startTime: '00:00', endTime: '01:00' });

        const stored = await prisma.doctorSchedule.findMany({ where: { doctorId: doctor.doctorId } });
        expect(stored).toHaveLength(1);
        expect(stored[0].dayOfWeek).toBe(0);
      } finally {
        await prisma.doctorSchedule.deleteMany({ where: { doctorId: doctor.doctorId } });
        if (original.length > 0) {
          await prisma.doctorSchedule.createMany({
            data: original.map(({ doctorId, dayOfWeek, startTime, endTime, isActive }) => ({ doctorId, dayOfWeek, startTime, endTime, isActive })),
          });
        }
        await prisma.auditLog.deleteMany({ where: { entityId: doctor.doctorId, actionType: 'ADMIN_SCHEDULE_UPDATE', createdAt: { gte: new Date(Date.now() - 60_000) } } });
      }
    });

    it('a 0-minute or 0-hour value is validated as a number, not skipped (duration 0 is rejected, cutoff 0 is accepted)', async () => {
      const zeroDuration = await request(app)
        .post('/api/v1/admin/services')
        .set(as('ADMIN'))
        .send({ serviceName: `Zero ${Date.now()}`, durationMinutes: 0 });
      expect(zeroDuration.status).toBe(400);
    });
  });

  // --------------------------------------------------------------------------
  describe('empty ClinicSetting table and zero-valued settings', () => {
    it('GET /settings/public recreates the default record instead of failing when the table is empty', async () => {
      const saved = await prisma.clinicSetting.findFirstOrThrow();
      try {
        await prisma.$transaction([
          prisma.auditLog.deleteMany({ where: { entityId: saved.settingId } }),
          prisma.clinicSetting.deleteMany({}),
        ]);
        const res = await request(app).get('/api/v1/settings/public');
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({
          clinicName: expect.any(String),
          timezone: 'Asia/Bangkok',
          fixedStartIntervalMinutes: 15,
          cancellationCutoffHours: 24,
        });
      } finally {
        await prisma.clinicSetting.deleteMany({});
        await prisma.clinicSetting.create({
          data: {
            settingId: saved.settingId,
            clinicName: saved.clinicName,
            timezone: saved.timezone,
            fixedStartIntervalMinutes: saved.fixedStartIntervalMinutes,
            cancellationCutoffHours: saved.cancellationCutoffHours,
            reminderLeadHours: saved.reminderLeadHours,
          },
        });
      }
    });

    it('a cancellation cutoff of 0 is stored and returned as 0 (not treated as "unset")', async () => {
      const saved = await prisma.clinicSetting.findFirstOrThrow();
      try {
        const patch = await request(app).patch('/api/v1/admin/settings').set(as('ADMIN')).send({ cancellationCutoffHours: 0 });
        expect(patch.status).toBe(200);
        expect(patch.body.data.cancellationCutoffHours).toBe(0);

        const pub = await request(app).get('/api/v1/settings/public');
        expect(pub.body.data.cancellationCutoffHours).toBe(0);

        // A later partial update that does not mention the cutoff must keep the 0.
        const other = await request(app).patch('/api/v1/admin/settings').set(as('ADMIN')).send({ fixedStartIntervalMinutes: 30 });
        expect(other.status).toBe(200);
        expect(other.body.data.cancellationCutoffHours).toBe(0);
      } finally {
        await prisma.clinicSetting.update({
          where: { settingId: saved.settingId },
          data: {
            cancellationCutoffHours: saved.cancellationCutoffHours,
            fixedStartIntervalMinutes: saved.fixedStartIntervalMinutes,
          },
        });
        await prisma.auditLog.deleteMany({ where: { entityId: saved.settingId, userId: { not: undefined } , actionType: 'CLINIC_SETTINGS_UPDATED', createdAt: { gte: new Date(Date.now() - 60_000) } } });
      }
    });
  });
});
