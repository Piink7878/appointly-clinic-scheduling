// ==============================================================================
// Appointly Server — Schedule Read-Access Tests (F-006 / F-007, NFR-004)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.6, 1.7 & 2.6; System-Level SDS Sections
//            5.2, 6.1, 6.2, 7.2
// A doctor's schedule includes free-text exception reasons (e.g. medical leave).
// There is exactly ONE way to read someone else's schedule — the ADMIN endpoint
// GET /admin/doctors/:doctorId/schedule. A doctor reads their own through
// /doctors/me/schedule. The old by-id aliases (/doctors/:id/schedule,
// /schedules/:id, /schedules/doctors/:id) were removed and must stay gone.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';
import { prisma } from '../../../src/shared/database';
import { cookiesOf } from '../../helpers';

describe('Doctor schedule read access (F-006 / F-007)', () => {
  const validPassword = 'ChangeMe123!';
  const stamp = Date.now();
  const PRIVATE_REASON = `Private medical leave ${stamp}`;

  let patientCookies: string[];
  let ownerCookies: string[]; // seeded doctor who owns the schedule
  let otherDoctorCookies: string[]; // a different doctor
  let adminCookies: string[];
  let ownerDoctorId: string;
  let inactiveDoctorId: string;
  let exceptionId: string;

  const createdEmails: string[] = [];
  const createdDoctorIds: string[] = [];

  const login = async (email: string) => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: validPassword });
    expect(res.status).toBe(200);
    return cookiesOf(res);
  };

  const createDoctor = async (label: string) => {
    const email = `privacy.${label}.${stamp}@appointly.local`;
    const res = await request(app)
      .post('/api/v1/admin/doctors')
      .set('Cookie', adminCookies)
      .send({ email, password: validPassword, fullName: `Dr. Privacy ${label}`, specialization: 'Privacy Testing' });
    expect(res.status).toBe(201);
    createdEmails.push(email);
    createdDoctorIds.push(res.body.data.doctorId);
    return { email, doctorId: res.body.data.doctorId as string };
  };

  /** Former aliases that exposed a schedule by doctor id. They no longer exist. */
  const removedAliases = (doctorId: string) => [
    `/api/v1/doctors/${doctorId}/schedule`,
    `/api/v1/schedules/${doctorId}`,
    `/api/v1/schedules/doctors/${doctorId}`,
    `/api/v1/schedules/doctors/${doctorId}/schedule`,
  ];

  beforeAll(async () => {
    adminCookies = await login('admin@appointly.local');
    patientCookies = await login('patient.arisa@appointly.local');
    ownerCookies = await login('doctor@appointly.local');

    const owner = await prisma.doctor.findFirstOrThrow({ where: { user: { email: 'doctor@appointly.local' } } });
    ownerDoctorId = owner.doctorId;
    const exception = await prisma.scheduleException.create({
      data: {
        doctorId: ownerDoctorId,
        exceptionDate: new Date('2099-06-01T00:00:00.000Z'),
        exceptionType: 'HOLIDAY',
        reason: PRIVATE_REASON,
        createdBy: owner.userId,
      },
    });
    exceptionId = exception.exceptionId;

    const other = await createDoctor('other');
    otherDoctorCookies = await login(other.email);

    const inactive = await createDoctor('inactive');
    inactiveDoctorId = inactive.doctorId;
    const deactivate = await request(app)
      .patch(`/api/v1/admin/doctors/${inactiveDoctorId}/status`)
      .set('Cookie', adminCookies)
      .send({ profileStatus: 'INACTIVE' });
    expect(deactivate.status).toBe(200);
  });

  afterAll(async () => {
    await prisma.scheduleException.deleteMany({ where: { exceptionId } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entityId: { in: createdDoctorIds } },
          ...createdDoctorIds.map((id) => ({ details: { path: ['doctorId'], equals: id } })),
        ],
      },
    });
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  });

  it.each([
    ['a PATIENT', () => patientCookies],
    ['a different DOCTOR', () => otherDoctorCookies],
    ['the schedule owner (they must use /doctors/me/schedule)', () => ownerCookies],
  ])('%s cannot read a schedule by doctor id (403) and no data leaks', async (_who, cookies) => {
    for (const doctorId of [ownerDoctorId, inactiveDoctorId]) {
      const res = await request(app)
        .get(`/api/v1/admin/doctors/${doctorId}/schedule`)
        .set('Cookie', cookies());
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
      expect(JSON.stringify(res.body)).not.toContain(PRIVATE_REASON);
    }
  });

  it('the former by-id aliases are gone: they answer 404 to every role, administrators included', async () => {
    const roles = [patientCookies, otherDoctorCookies, ownerCookies, adminCookies];
    for (const cookies of roles) {
      for (const url of removedAliases(ownerDoctorId)) {
        const res = await request(app).get(url).set('Cookie', cookies);
        expect(res.status, url).toBe(404);
        expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
        expect(JSON.stringify(res.body)).not.toContain(PRIVATE_REASON);
      }
    }
  });

  it('unauthenticated requests get 401', async () => {
    const res = await request(app).get(`/api/v1/admin/doctors/${ownerDoctorId}/schedule`);
    expect(res.status).toBe(401);
  });

  it('an ADMIN can read any doctor\'s schedule, including exception reasons', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/doctors/${ownerDoctorId}/schedule`)
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.body.data.exceptions.map((e: { reason: string | null }) => e.reason)).toContain(PRIVATE_REASON);
  });

  it('a doctor can still read their OWN schedule and exceptions through /doctors/me/schedule', async () => {
    const res = await request(app).get('/api/v1/doctors/me/schedule').set('Cookie', ownerCookies);
    expect(res.status).toBe(200);
    expect(res.body.data.exceptions.map((e: { reason: string | null }) => e.reason)).toContain(PRIVATE_REASON);
  });

  it('another doctor\'s /me/schedule never contains the owner\'s exceptions', async () => {
    const res = await request(app).get('/api/v1/doctors/me/schedule').set('Cookie', otherDoctorCookies);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(PRIVATE_REASON);
  });

  it('IDOR: a doctor cannot delete another doctor\'s exception, through either endpoint', async () => {
    const own = await request(app)
      .delete(`/api/v1/doctors/me/exceptions/${exceptionId}`)
      .set('Cookie', otherDoctorCookies);
    expect(own.status).toBe(404); // masked, not 403 (NFR-004)

    const admin = await request(app)
      .delete(`/api/v1/admin/doctors/${ownerDoctorId}/exceptions/${exceptionId}`)
      .set('Cookie', otherDoctorCookies);
    expect(admin.status).toBe(403);

    expect(await prisma.scheduleException.count({ where: { exceptionId } })).toBe(1);
  });
});
