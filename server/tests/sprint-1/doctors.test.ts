// ==============================================================================
// Appointly Server — Doctor Management Integration & API Tests (F-003, F-005)
// ==============================================================================
// Reference: System-Level SDS Section 3.2C, 3.2L, 5.2, 6, 7 & Sprint 1 Contracts (F-003, F-005)
// Test Catalog: STS-S1-003, STS-S1-005, STS-S1-007
// Acceptance Criteria:
//   - AC-F003-01 (Positive — Doctor Creation & Visibility)
//   - AC-F003-02 (Negative — Deactivated Doctor Filtering & RBAC)
//   - AC-F003-03 (Boundary — Duplicate Email & Field Length)
//   - AC-F005-01 (Positive — Assignment & Filtered Retrieval)
//   - AC-F005-02 (Negative — Duplicate Assignment Rejection)
//   - AC-F005-03 (Boundary — Zero Assigned Doctors)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/shared/database';

describe('Doctor Management System (F-003, F-005)', () => {
  const validPassword = 'ChangeMe123!';
  const patientEmail = 'patient.arisa@appointly.local';
  const doctorEmail = 'doctor@appointly.local';
  const adminEmail = 'admin@appointly.local';

  let patientCookies: string[];
  let doctorCookies: string[];
  let adminCookies: string[];
  let adminUserId: string;

  // Track created doctors/users for cleanup
  const createdUserEmails: string[] = [];

  beforeAll(async () => {
    // 1. Authenticate patient (patient.arisa@appointly.local)
    const patientLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: patientEmail, password: validPassword });
    expect(patientLogin.status).toBe(200);
    patientCookies = patientLogin.headers['set-cookie'];

    // 2. Authenticate doctor (doctor@appointly.local)
    const doctorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: doctorEmail, password: validPassword });
    expect(doctorLogin.status).toBe(200);
    doctorCookies = doctorLogin.headers['set-cookie'];

    // 3. Authenticate admin (admin@appointly.local)
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: validPassword });
    expect(adminLogin.status).toBe(200);
    adminCookies = adminLogin.headers['set-cookie'];
    adminUserId = adminLogin.body.data.userId;
  });

  afterAll(async () => {
    // Clean up created test accounts to maintain test isolation
    if (createdUserEmails.length > 0) {
      await prisma.user.deleteMany({
        where: {
          email: { in: createdUserEmails },
        },
      });
    }
  });

  // ============================================================================
  // 1. AC-F003-01 / STS-S1-005 (Positive — Doctor Creation & Visibility)
  // ============================================================================
  describe('1. AC-F003-01 / STS-S1-005 (Positive — Doctor Creation & Visibility)', () => {
    it('Admin successfully creates a new doctor with ACTIVE status via POST /api/v1/admin/doctors (201 Created), records exist in User, Doctor, and AuditLog tables, and Patient sees the doctor and their specialization via GET /api/v1/doctors', async () => {
      const newDoctorEmail = `dr.creation.vis.${Date.now()}@appointly.local`;
      createdUserEmails.push(newDoctorEmail);
      const newDoctorPassword = 'SecurePassword123!';

      const payload = {
        email: newDoctorEmail,
        password: newDoctorPassword,
        fullName: 'Dr. Thana Vatanakul',
        specialization: 'Pediatric Cardiology',
        professionalLicenseNumber: 'MD-55441',
      };

      // Step A: Admin creates doctor via POST /api/v1/admin/doctors
      const createRes = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send(payload);

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.doctorId).toBeDefined();
      expect(createRes.body.data.email).toBe(newDoctorEmail.toLowerCase());
      expect(createRes.body.data.fullName).toBe(payload.fullName);
      expect(createRes.body.data.specialization).toBe(payload.specialization);
      expect(createRes.body.data.professionalLicenseNumber).toBe(payload.professionalLicenseNumber);
      expect(createRes.body.data.profileStatus).toBe('ACTIVE');
      expect(createRes.body.data.accountStatus).toBe('ACTIVE');

      const createdDoctorId = createRes.body.data.doctorId;
      const createdUserId = createRes.body.data.userId;

      // Step B: Verify User table in PostgreSQL
      const dbUser = await prisma.user.findUnique({
        where: { userId: createdUserId },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.email).toBe(newDoctorEmail.toLowerCase());
      expect(dbUser?.role).toBe('DOCTOR');
      expect(dbUser?.accountStatus).toBe('ACTIVE');
      // Password must be hashed using Argon2id ($argon2id$)
      expect(dbUser?.passwordHash).toMatch(/^\$argon2id\$/);

      // Step C: Verify Doctor table in PostgreSQL
      const dbDoctor = await prisma.doctor.findUnique({
        where: { doctorId: createdDoctorId },
      });
      expect(dbDoctor).not.toBeNull();
      expect(dbDoctor?.userId).toBe(createdUserId);
      expect(dbDoctor?.fullName).toBe(payload.fullName);
      expect(dbDoctor?.specialization).toBe(payload.specialization);
      expect(dbDoctor?.professionalLicenseNumber).toBe(payload.professionalLicenseNumber);
      expect(dbDoctor?.profileStatus).toBe('ACTIVE');

      // Step D: Verify AuditLog table in PostgreSQL (action_type: DOCTOR_CREATED)
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: createdDoctorId,
          actionType: 'DOCTOR_CREATED',
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(adminUserId);
      expect(auditLog?.entityType).toBe('Doctor');
      expect(auditLog?.details).toMatchObject({
        email: newDoctorEmail.toLowerCase(),
        fullName: payload.fullName,
        specialization: payload.specialization,
      });

      // Step E: Patient queries GET /api/v1/doctors and verifies doctor and specialization are visible
      const patientGetRes = await request(app)
        .get('/api/v1/doctors')
        .set('Cookie', patientCookies);

      expect(patientGetRes.status).toBe(200);
      expect(patientGetRes.body.success).toBe(true);
      expect(Array.isArray(patientGetRes.body.data)).toBe(true);

      const foundInPatientList = patientGetRes.body.data.find(
        (doc: any) => doc.doctorId === createdDoctorId
      );
      expect(foundInPatientList).toBeDefined();
      expect(foundInPatientList.fullName).toBe(payload.fullName);
      expect(foundInPatientList.specialization).toBe(payload.specialization);
      expect(foundInPatientList.profileStatus).toBe('ACTIVE');

      // Step F: Verify newly created doctor can log in with their credentials
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: newDoctorEmail,
          password: newDoctorPassword,
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.role).toBe('DOCTOR');
    });

    it('should allow querying single doctor by ID via GET /api/v1/doctors/:doctorId', async () => {
      const activeDoctor = await prisma.doctor.findFirst({
        where: { profileStatus: 'ACTIVE', user: { accountStatus: 'ACTIVE' } },
      });
      expect(activeDoctor).not.toBeNull();

      const res = await request(app)
        .get(`/api/v1/doctors/${activeDoctor!.doctorId}`)
        .set('Cookie', patientCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.doctorId).toBe(activeDoctor!.doctorId);
      expect(res.body.data.fullName).toBe(activeDoctor!.fullName);
      expect(res.body.data.specialization).toBe(activeDoctor!.specialization);
    });
  });

  // ============================================================================
  // 2. AC-F003-02 / STS-S1-005 (Negative — Deactivated Doctor Filtering & RBAC)
  // ============================================================================
  describe('2. AC-F003-02 / STS-S1-005 (Negative — Deactivated Doctor Filtering & RBAC)', () => {
    let testDoctorId: string;
    let testUserId: string;
    const deactivatedDocEmail = `dr.deactivated.${Date.now()}@appointly.local`;

    beforeAll(async () => {
      createdUserEmails.push(deactivatedDocEmail);
      // Create a test doctor for status toggle
      const createRes = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send({
          email: deactivatedDocEmail,
          password: 'Password123!',
          fullName: 'Dr. Deactivation Lifecycle Test',
          specialization: 'Neurology',
          professionalLicenseNumber: 'MD-88112',
        });
      expect(createRes.status).toBe(201);
      testDoctorId = createRes.body.data.doctorId;
      testUserId = createRes.body.data.userId;
    });

    it('Admin updates status to INACTIVE via PATCH /api/v1/admin/doctors/:doctorId/status (200 OK) -> Patient cannot see the doctor, while Admin still sees them in the list', async () => {
      // Step A: Admin deactivates doctor
      const patchRes = await request(app)
        .patch(`/api/v1/admin/doctors/${testDoctorId}/status`)
        .set('Cookie', adminCookies)
        .send({ profileStatus: 'INACTIVE' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);
      expect(patchRes.body.data.profileStatus).toBe('INACTIVE');
      expect(patchRes.body.data.accountStatus).toBe('INACTIVE');

      // Step B: Verify Doctor table profile_status is INACTIVE
      const dbDoctor = await prisma.doctor.findUnique({
        where: { doctorId: testDoctorId },
      });
      expect(dbDoctor?.profileStatus).toBe('INACTIVE');

      // Step C: Verify User table account_status is synchronized to INACTIVE
      const dbUser = await prisma.user.findUnique({
        where: { userId: testUserId },
      });
      expect(dbUser?.accountStatus).toBe('INACTIVE');

      // Step D: Verify AuditLog (action_type: DOCTOR_STATUS_UPDATED)
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: testDoctorId,
          actionType: 'DOCTOR_STATUS_UPDATED',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(adminUserId);
      expect(auditLog?.details).toMatchObject({
        previousProfileStatus: 'ACTIVE',
        newProfileStatus: 'INACTIVE',
        newAccountStatus: 'INACTIVE',
      });

      // Step E: Patient queries GET /api/v1/doctors -> Deactivated doctor is EXCLUDED (BR-003, FR-013)
      const patientGetRes = await request(app)
        .get('/api/v1/doctors')
        .set('Cookie', patientCookies);

      expect(patientGetRes.status).toBe(200);
      const isVisibleToPatient = patientGetRes.body.data.some(
        (doc: any) => doc.doctorId === testDoctorId
      );
      expect(isVisibleToPatient).toBe(false);

      // Step F: Admin queries GET /api/v1/doctors -> Admin STILL sees the deactivated doctor
      const adminGetRes = await request(app)
        .get('/api/v1/doctors')
        .set('Cookie', adminCookies);

      expect(adminGetRes.status).toBe(200);
      const isVisibleToAdmin = adminGetRes.body.data.some(
        (doc: any) => doc.doctorId === testDoctorId
      );
      expect(isVisibleToAdmin).toBe(true);

      // Step G: Admin queries with ?status=INACTIVE filter -> doctor is present
      const adminInactiveRes = await request(app)
        .get('/api/v1/doctors?status=INACTIVE')
        .set('Cookie', adminCookies);

      expect(adminInactiveRes.status).toBe(200);
      expect(
        adminInactiveRes.body.data.some((doc: any) => doc.doctorId === testDoctorId)
      ).toBe(true);

      // Step H: Deactivated doctor attempting to log in is rejected with 403 Forbidden (ACCOUNT_INACTIVE)
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: deactivatedDocEmail,
          password: 'Password123!',
        });
      expect(loginRes.status).toBe(403);
      expect(loginRes.body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('PATIENT attempting to call POST /api/v1/admin/doctors is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', patientCookies)
        .send({
          email: 'unauth.by.patient@appointly.local',
          password: 'Password123!',
          fullName: 'Dr. Illegitimate',
          specialization: 'Internal Medicine',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('DOCTOR attempting to call POST /api/v1/admin/doctors is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', doctorCookies)
        .send({
          email: 'unauth.by.doctor@appointly.local',
          password: 'Password123!',
          fullName: 'Dr. Illegitimate',
          specialization: 'Internal Medicine',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('PATIENT attempting to call PATCH /api/v1/admin/doctors/:doctorId/status is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/doctors/${testDoctorId}/status`)
        .set('Cookie', patientCookies)
        .send({ profileStatus: 'ACTIVE' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('DOCTOR attempting to call PATCH /api/v1/admin/doctors/:doctorId/status is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/doctors/${testDoctorId}/status`)
        .set('Cookie', doctorCookies)
        .send({ profileStatus: 'ACTIVE' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should restore visibility and login when Admin reactivates doctor', async () => {
      // Admin reactivates doctor
      const patchRes = await request(app)
        .patch(`/api/v1/admin/doctors/${testDoctorId}/status`)
        .set('Cookie', adminCookies)
        .send({ profileStatus: 'ACTIVE' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.profileStatus).toBe('ACTIVE');
      expect(patchRes.body.data.accountStatus).toBe('ACTIVE');

      // Patient now sees the reactivated doctor
      const patientGetRes = await request(app)
        .get('/api/v1/doctors')
        .set('Cookie', patientCookies);

      expect(patientGetRes.status).toBe(200);
      expect(
        patientGetRes.body.data.some((doc: any) => doc.doctorId === testDoctorId)
      ).toBe(true);

      // Doctor can log in again
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: deactivatedDocEmail,
          password: 'Password123!',
        });
      expect(loginRes.status).toBe(200);
    });
  });

  // ============================================================================
  // 3. AC-F003-03 / STS-S1-005 (Boundary — Duplicate Email & Field Length)
  // ============================================================================
  describe('3. AC-F003-03 / STS-S1-005 (Boundary — Duplicate Email & Field Length)', () => {
    it('Creating a doctor with an email that already exists in the User table returns 409 Conflict (EMAIL_ALREADY_EXISTS)', async () => {
      // 1. Existing seeded doctor email (doctor@appointly.local)
      const resExact = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send({
          email: doctorEmail,
          password: 'NewDoctorPass123!',
          fullName: 'Dr. Exact Duplicate',
          specialization: 'General Surgery',
        });

      expect(resExact.status).toBe(409);
      expect(resExact.body.success).toBe(false);
      expect(resExact.body.error.code).toBe('EMAIL_ALREADY_EXISTS');

      // 2. Case-insensitive duplicate check (DOCTOR@APPOINTLY.LOCAL with spaces)
      const resCaseInsensitive = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send({
          email: '   DOCTOR@APPOINTLY.LOCAL   ',
          password: 'NewDoctorPass123!',
          fullName: 'Dr. Uppercase Duplicate',
          specialization: 'General Surgery',
        });

      expect(resCaseInsensitive.status).toBe(409);
      expect(resCaseInsensitive.body.success).toBe(false);
      expect(resCaseInsensitive.body.error.code).toBe('EMAIL_ALREADY_EXISTS');

      // 3. Email of an existing PATIENT user
      const resPatientEmail = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send({
          email: patientEmail,
          password: 'NewDoctorPass123!',
          fullName: 'Dr. Patient Email Conflict',
          specialization: 'General Surgery',
        });

      expect(resPatientEmail.status).toBe(409);
      expect(resPatientEmail.body.success).toBe(false);
      expect(resPatientEmail.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('Submitting a specialization with a length of 150 characters succeeds (201 Created)', async () => {
      const boundaryEmail150 = `dr.spec150.${Date.now()}@appointly.local`;
      createdUserEmails.push(boundaryEmail150);

      const spec150 = 'S'.repeat(150);
      const res = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send({
          email: boundaryEmail150,
          password: 'Password123!',
          fullName: 'Dr. Valid Boundary Spec',
          specialization: spec150,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.specialization).toBe(spec150);
      expect(res.body.data.specialization.length).toBe(150);
    });

    it('Submitting a specialization with a length of 151 characters returns 400 Bad Request', async () => {
      const spec151 = 'S'.repeat(151);
      const res = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send({
          email: `dr.spec151.${Date.now()}@appointly.local`,
          password: 'Password123!',
          fullName: 'Dr. Exceed Boundary Spec',
          specialization: spec151,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Submitting fullName with 150 characters succeeds (201) and 151 characters returns 400 Bad Request', async () => {
      const name150Email = `dr.name150.${Date.now()}@appointly.local`;
      createdUserEmails.push(name150Email);

      // 150 chars succeeds
      const res150 = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send({
          email: name150Email,
          password: 'Password123!',
          fullName: 'N'.repeat(150),
          specialization: 'Family Medicine',
        });
      expect(res150.status).toBe(201);
      expect(res150.body.data.fullName.length).toBe(150);

      // 151 chars fails (400)
      const res151 = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send({
          email: `dr.name151.${Date.now()}@appointly.local`,
          password: 'Password123!',
          fullName: 'N'.repeat(151),
          specialization: 'Family Medicine',
        });
      expect(res151.status).toBe(400);
    });

    it('Submitting professionalLicenseNumber with 100 characters succeeds (201) and 101 characters returns 400 Bad Request', async () => {
      const lic100Email = `dr.lic100.${Date.now()}@appointly.local`;
      createdUserEmails.push(lic100Email);

      // 100 chars succeeds
      const res100 = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send({
          email: lic100Email,
          password: 'Password123!',
          fullName: 'Dr. License Boundary',
          specialization: 'Oncology',
          professionalLicenseNumber: 'L'.repeat(100),
        });
      expect(res100.status).toBe(201);
      expect(res100.body.data.professionalLicenseNumber.length).toBe(100);

      // 101 chars fails (400)
      const res101 = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send({
          email: `dr.lic101.${Date.now()}@appointly.local`,
          password: 'Password123!',
          fullName: 'Dr. License Exceeded',
          specialization: 'Oncology',
          professionalLicenseNumber: 'L'.repeat(101),
        });
      expect(res101.status).toBe(400);
    });

    it('Submitting password less than 8 characters returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/admin/doctors')
        .set('Cookie', adminCookies)
        .send({
          email: `dr.shortpass.${Date.now()}@appointly.local`,
          password: 'short',
          fullName: 'Dr. Short Password',
          specialization: 'Radiology',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================================
  // 4. PUT /api/v1/admin/doctors/:doctorId: Profile Update
  // ============================================================================
  describe('4. PUT /api/v1/admin/doctors/:doctorId: Profile Update', () => {
    let testDoctorId: string;

    beforeAll(async () => {
      const doctor = await prisma.doctor.findFirst({
        where: { user: { email: doctorEmail } },
      });
      testDoctorId = doctor!.doctorId;
    });

    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/doctors/${testDoctorId}`)
        .send({
          fullName: 'Dr. Updated Unauth',
          specialization: 'Cardiology',
        });
      expect(res.status).toBe(401);
    });

    it('should reject non-admin roles with 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/doctors/${testDoctorId}`)
        .set('Cookie', patientCookies)
        .send({
          fullName: 'Dr. Updated Patient',
          specialization: 'Cardiology',
        });
      expect(res.status).toBe(403);
    });

    it('should return 404 Not Found for non-existent doctorId', async () => {
      const nonExistentId = '00000000-0000-4000-8000-000000000000';
      const res = await request(app)
        .put(`/api/v1/admin/doctors/${nonExistentId}`)
        .set('Cookie', adminCookies)
        .send({
          fullName: 'Dr. Nonexistent',
          specialization: 'Cardiology',
        });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DOCTOR_NOT_FOUND');
    });

    it('should update doctor fullName, specialization, and license (200 OK)', async () => {
      const updatePayload = {
        fullName: 'Dr. Somchai Prasert (Lead Physician)',
        specialization: 'Internal Medicine & Cardiology',
        professionalLicenseNumber: 'MD-10001-REV2',
      };

      const res = await request(app)
        .put(`/api/v1/admin/doctors/${testDoctorId}`)
        .set('Cookie', adminCookies)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fullName).toBe(updatePayload.fullName);
      expect(res.body.data.specialization).toBe(updatePayload.specialization);
      expect(res.body.data.professionalLicenseNumber).toBe(updatePayload.professionalLicenseNumber);

      // Verify DB persistence
      const dbDoctor = await prisma.doctor.findUnique({
        where: { doctorId: testDoctorId },
      });
      expect(dbDoctor?.fullName).toBe(updatePayload.fullName);
      expect(dbDoctor?.specialization).toBe(updatePayload.specialization);
      expect(dbDoctor?.professionalLicenseNumber).toBe(updatePayload.professionalLicenseNumber);
    });
  });

  // ============================================================================
  // 5. F-005 Doctor-Service Assignment & Filtered Retrieval
  // ============================================================================
  describe('5. F-005 Doctor-Service Assignment & Filtered Retrieval', () => {
    let activeDoctorId: string;
    let activeServiceId: string;

    beforeAll(async () => {
      // Fetch or seed active service
      let service = await prisma.medicalService.findFirst({
        where: { serviceStatus: 'ACTIVE' },
      });
      if (!service) {
        service = await prisma.medicalService.create({
          data: {
            serviceName: 'General Consultation Test',
            durationMinutes: 30,
            serviceStatus: 'ACTIVE',
          },
        });
      }
      activeServiceId = service.serviceId;

      const doctor = await prisma.doctor.findFirst({
        where: { profileStatus: 'ACTIVE' },
      });
      activeDoctorId = doctor!.doctorId;
    });

    it('should assign service to doctor via POST /api/v1/admin/doctors/:doctorId/services (201 Created)', async () => {
      // First clean any existing assignment
      await prisma.doctorService.deleteMany({
        where: { doctorId: activeDoctorId, serviceId: activeServiceId },
      });

      const res = await request(app)
        .post(`/api/v1/admin/doctors/${activeDoctorId}/services`)
        .set('Cookie', adminCookies)
        .send({ serviceId: activeServiceId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.doctorId).toBe(activeDoctorId);
      expect(res.body.data.serviceId).toBe(activeServiceId);
    });

    it('should reject duplicate assignment with 409 Conflict (DUPLICATE_ASSIGNMENT) (AC-F005-02)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/doctors/${activeDoctorId}/services`)
        .set('Cookie', adminCookies)
        .send({ serviceId: activeServiceId });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DUPLICATE_ASSIGNMENT');
    });

    it('should filter doctors by serviceId via GET /api/v1/doctors?serviceId=... (AC-F005-01)', async () => {
      const res = await request(app)
        .get(`/api/v1/doctors?serviceId=${activeServiceId}`)
        .set('Cookie', patientCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((d: any) => d.doctorId === activeDoctorId)).toBe(true);
    });

    it('should return empty array for non-assigned service (AC-F005-03)', async () => {
      // Create empty service with no doctors assigned
      const emptyService = await prisma.medicalService.upsert({
        where: { serviceName: 'Empty Unassigned Service Test' },
        update: {},
        create: {
          serviceName: 'Empty Unassigned Service Test',
          durationMinutes: 15,
          serviceStatus: 'ACTIVE',
        },
      });

      const res = await request(app)
        .get(`/api/v1/doctors?serviceId=${emptyService.serviceId}`)
        .set('Cookie', patientCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('should unassign service via DELETE /api/v1/admin/doctors/:doctorId/services/:serviceId (200 OK)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/doctors/${activeDoctorId}/services/${activeServiceId}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deletion in DB
      const dbAssignment = await prisma.doctorService.findUnique({
        where: {
          doctorId_serviceId: {
            doctorId: activeDoctorId,
            serviceId: activeServiceId,
          },
        },
      });
      expect(dbAssignment).toBeNull();
    });
  });
});
