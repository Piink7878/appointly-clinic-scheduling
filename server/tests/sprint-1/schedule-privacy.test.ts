// ==============================================================================
// Appointly Server — Schedule Read-Access Tests (F-006, NFR-004)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.6 & 2.6; System-Level SDS Sections 6.1,
//            6.2, 7.2
// A doctor's schedule includes free-text exception reasons (e.g. medical leave).
// Patients and other doctors must not read it: a doctor reads their own schedule
// through /doctors/me/schedule, and only an ADMIN may read any doctor's schedule.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/shared/database';

describe('Doctor schedule read access (F-006)', () => {
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
    return res.headers['set-cookie'] as string[];
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

  /** Every non-admin route that reads another doctor's schedule. */
  const routesFor = (doctorId: string) => [
    `/api/v1/doctors/${doctorId}/schedule`,
    `/api/v1/schedules/${doctorId}`,
    `/api/v1/schedules/doctors/${doctorId}`,
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
    ['the schedule owner via the :doctorId routes (they must use /me)', () => ownerCookies],
  ])('%s gets 403 on every route that reads a schedule by doctorId, and no data leaks', async (_who, cookies) => {
    for (const url of routesFor(ownerDoctorId)) {
      const res = await request(app).get(url).set('Cookie', cookies());
      expect(res.status, url).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(JSON.stringify(res.body)).not.toContain(PRIVATE_REASON);
    }
  });

  it('inactive doctors\' schedules are not readable by patients either', async () => {
    for (const url of routesFor(inactiveDoctorId)) {
      const res = await request(app).get(url).set('Cookie', patientCookies);
      expect(res.status, url).toBe(403);
    }
  });

  it('unauthenticated requests get 401', async () => {
    for (const url of routesFor(ownerDoctorId)) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(401);
    }
  });

  it('an ADMIN can still read any doctor\'s schedule, including exception reasons', async () => {
    for (const url of [...routesFor(ownerDoctorId), `/api/v1/admin/doctors/${ownerDoctorId}/schedule`]) {
      const res = await request(app).get(url).set('Cookie', adminCookies);
      expect(res.status, url).toBe(200);
      expect(res.body.data.exceptions.map((e: any) => e.reason)).toContain(PRIVATE_REASON);
    }
  });

  it('a doctor can still read their OWN schedule and exceptions through /doctors/me/schedule', async () => {
    const res = await request(app).get('/api/v1/doctors/me/schedule').set('Cookie', ownerCookies);
    expect(res.status).toBe(200);
    expect(res.body.data.exceptions.map((e: any) => e.reason)).toContain(PRIVATE_REASON);
  });

  it('another doctor\'s /me/schedule never contains the owner\'s exceptions', async () => {
    const res = await request(app).get('/api/v1/doctors/me/schedule').set('Cookie', otherDoctorCookies);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(PRIVATE_REASON);
  });
});
