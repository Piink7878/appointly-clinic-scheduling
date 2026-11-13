# Appointly — Sprint 1 Engineering Contracts

* **Product Name:** Appointly
* **System Name:** Clinic Appointment & Scheduling Management System
* **Sprint Scope:** Sprint 1 — System Foundation & Clinic Configuration (`F-001` to `F-007`)
* **Document Version:** 1.0 — Deliverable 1 Baseline Confirmed
* **Reference Documents:** SRS & Product Scope v1.0; Feature Inventory & Traceability v1.0; System-Level SDS v1.0; Three-Sprint Implementation Plan v1.0
* **Status:** Engineering Baseline Approved

---

## Document & Contract Version History

| Version | Date | Author(s) | Summary of Changes & Engineering Justification |
| :--- | :--- | :--- | :--- |
| **v0.1** | 2026-11-01 | Appointly Team | Initial draft of Sprint 1 contracts (`F-001` to `F-007`), data schemas, REST endpoints, Acceptance Criteria, and STS test cases. |
| **v1.0** | 2026-11-03 | Appointly Team | Aligned Sprint 1 baseline with Project Deliverable 1 & Lab 5 specifications: (1) scoped `F-001` & `F-002` to seeded test accounts with `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, and `GET/PUT /patients/me` (`DEC-017`), deferring self-registration, password change, and account suspension to Sprint 2; (2) designated `F-006` (Doctor Self-Schedule) and `F-005` (Doctor-Service Assignment) as primary Sprint 1 domain journeys; (3) moved Docker, CI/CD, and cloud smoke test gates out of Sprint 1 DoD into Lab 5 readiness criteria. |

---

## 1. Sprint 1 Feature-Level SDS Contracts (`F-001` to `F-007`)

### 1.1 F-001: Authentication & Role Management (Sprint 1 Core Scope)

* **Mapped Requirements:** `FR-002`, `FR-003`, `FR-004`; `BR-011`, `BR-032`; `NFR-001` to `NFR-004`, `NFR-006`, `NFR-008`, `NFR-023`, `NFR-025`; `DEC-017`
* **Scope Note:** Per `DEC-017`, Sprint 1 uses reproducible seeded test accounts (`PATIENT`, `DOCTOR`, `ADMIN`). Self-service registration (`FR-001`) and password recovery (`FR-005`) are deferred to Sprint 2.
* **Data Schema Contract (`User`):**
  * `User`: `user_id` (`UUID PK`), `email` (`VARCHAR(255) UNIQUE NOT NULL`, lowercase trimmed), `password_hash` (`VARCHAR(255) NOT NULL`, Argon2id), `role` (`ENUM: PATIENT, DOCTOR, ADMIN`), `account_status` (`ENUM: ACTIVE, INACTIVE`, default `ACTIVE`), `refresh_token_hash` (`VARCHAR(255) NULLABLE`), `created_at` (`TIMESTAMPTZ UTC`), `updated_at` (`TIMESTAMPTZ UTC`).
* **API Contract:**
  * `POST /api/v1/auth/login` (**Public**): Accepts `{ email, password }`. Verifies Argon2id hash and `account_status === 'ACTIVE'`. Sets `access_token` (15m TTL) and `refresh_token` (7d TTL) in `HttpOnly; SameSite=Strict` cookies (`Secure` when `COOKIE_SECURE=true`). Returns `200 OK` with `{ userId, email, role }`. Returns `401 Unauthorized` on invalid credentials and `403 Forbidden` (`ACCOUNT_INACTIVE`) if inactive.
  * `GET /api/v1/auth/me` (**Authenticated**): Reads `access_token` cookie, verifies JWT, and returns `200 OK` with `{ userId, email, role, profileId, fullName }`. Returns `401 Unauthorized` if unauthenticated or expired.
  * `POST /api/v1/auth/refresh` (**Authenticated via refresh cookie**): Verifies `refresh_token` against `User.refresh_token_hash`, rotates token, and sets updated cookies. Returns `200 OK`.
  * `POST /api/v1/auth/logout` (**Authenticated**): Clears `access_token` and `refresh_token` cookies and sets `User.refresh_token_hash = NULL` in PostgreSQL. Returns `200 OK`.
* **UI Contract:**
  * Login Page (`/login`) with email/password validation, error alert banner on failed login, and role-based post-login redirect (`/patient/services`, `/doctor/schedule`, `/admin/doctors`).
  * Authenticated top navigation bar displaying current user identity/role from `GET /api/v1/auth/me` and a Logout button.
  * Client-side route guards redirecting unauthenticated visitors to `/login` and unauthorized roles to `/unauthorized` (backed by authoritative backend RBAC enforcement).

### 1.2 F-002: Patient Profile Management (Sprint 1 Core Scope)

* **Mapped Requirements:** `FR-004`, `FR-006`, `FR-007`, `FR-008` (Directory View); `BR-010`, `BR-011`; `NFR-003`, `NFR-004`, `NFR-007`, `NFR-008`
* **Scope Note:** Advanced patient account status suspension (`PATCH /api/v1/admin/patients/:id/status`) is deferred to Sprint 2.
* **Data Schema Contract (`Patient`):**
  * `Patient`: `patient_id` (`UUID PK`), `user_id` (`UUID FK -> User.user_id UNIQUE NOT NULL`), `full_name` (`VARCHAR(150) NOT NULL`), `phone_number` (`VARCHAR(30) NOT NULL`, standard Thai mobile format `0[689]\d{8}` or E.164), `date_of_birth` (`DATE NULLABLE`, must be strictly in the past), `created_at` (`TIMESTAMPTZ UTC`), `updated_at` (`TIMESTAMPTZ UTC`).
* **API Contract:**
  * `GET /api/v1/patients/me` (**PATIENT**): Returns authenticated patient's own profile (`patientId`, `email`, `fullName`, `phoneNumber`, `dateOfBirth`).
  * `PUT /api/v1/patients/me` (**PATIENT**): Updates `fullName`, `phoneNumber`, and optional `dateOfBirth` for the authenticated patient only (`BR-010`, `BR-011`). Returns `200 OK` or `400 Bad Request` on validation failure.
  * `GET /api/v1/admin/patients` (**ADMIN**): Returns paginated list of patients (`?search=nameOrEmailOrPhone&page=1&limit=20`).
* **UI Contract:**
  * Patient Profile Page (`/patient/profile`) allowing the logged-in patient to inspect and update personal contact fields with inline validation and success toast feedback.
  * Admin Patient Directory (`/admin/patients`) with search input and responsive table/card list.

### 1.3 F-003: Doctor Profile Management

* **Mapped Requirements:** `FR-009`, `FR-010`, `FR-012`, `FR-013`; `BR-003`; `NFR-014`, `NFR-015`
* **Data Schema Contract (`Doctor`, `User`, `AuditLog`):**
  * `Doctor`: `doctor_id` (`UUID PK`), `user_id` (`UUID FK -> User.user_id UNIQUE NOT NULL`), `full_name` (`VARCHAR(150) NOT NULL`), `specialization` (`VARCHAR(150) NOT NULL`), `professional_license_number` (`VARCHAR(100) NULLABLE`), `profile_status` (`ENUM: ACTIVE, INACTIVE`, default `ACTIVE`), `created_at` (`TIMESTAMPTZ UTC`), `updated_at` (`TIMESTAMPTZ UTC`).
* **API Contract:**
  * `GET /api/v1/doctors` (**PATIENT, DOCTOR, ADMIN**): Returns only `profile_status = 'ACTIVE'` doctors when queried by `PATIENT` or `DOCTOR`; returns all doctors (with optional `?status=` filter) when queried by `ADMIN`.
  * `POST /api/v1/admin/doctors` (**ADMIN**): Accepts `{ email, password, fullName, specialization, professionalLicenseNumber? }`. Atomically creates `User` (`role = 'DOCTOR'`, Argon2id hashed password) and `Doctor` profile. Returns `201 Created` or `409 Conflict` (`EMAIL_ALREADY_EXISTS`).
  * `PUT /api/v1/admin/doctors/:doctorId` (**ADMIN**): Updates `fullName`, `specialization`, and `professionalLicenseNumber`. Returns `200 OK` or `404 Not Found`.
  * `PATCH /api/v1/admin/doctors/:doctorId/status` (**ADMIN**): Updates `profile_status` (`ACTIVE` or `INACTIVE`) and records an `AuditLog` entry (`DOCTOR_STATUS_UPDATED`). Returns `200 OK`.
* **UI Contract:**
  * Patient Doctor Directory (`/patient/doctors`) displaying active doctors, specialties, and assigned services.
  * Admin Doctor Management Page (`/admin/doctors`) with Create/Edit Doctor Modal, status badge, and Activate/Deactivate confirmation modal.

### 1.4 F-004: Medical Service Catalog

* **Mapped Requirements:** `FR-014`, `FR-015`, `FR-016`, `FR-018`; `BR-004`; `NFR-014`, `NFR-015`
* **Data Schema Contract (`MedicalService`, `AuditLog`):**
  * `MedicalService`: `service_id` (`UUID PK`), `service_name` (`VARCHAR(150) UNIQUE NOT NULL`), `description` (`TEXT NULLABLE`), `duration_minutes` (`INTEGER NOT NULL`, `CHECK (duration_minutes > 0 AND duration_minutes <= 480)`), `service_status` (`ENUM: ACTIVE, INACTIVE`, default `ACTIVE`), `created_at` (`TIMESTAMPTZ UTC`), `updated_at` (`TIMESTAMPTZ UTC`).
* **API Contract:**
  * `GET /api/v1/services` (**PATIENT, DOCTOR, ADMIN**): Returns only `service_status = 'ACTIVE'` services for `PATIENT` and `DOCTOR`; returns all services for `ADMIN`.
  * `POST /api/v1/admin/services` (**ADMIN**): Accepts `{ serviceName, description?, durationMinutes }`. Validates `durationMinutes` is an integer between `1` and `480`. Returns `201 Created` or `409 Conflict` (`SERVICE_NAME_EXISTS`).
  * `PUT /api/v1/admin/services/:serviceId` (**ADMIN**): Updates `serviceName`, `description`, and `durationMinutes`. Returns `200 OK`.
  * `PATCH /api/v1/admin/services/:serviceId/status` (**ADMIN**): Toggles `ACTIVE` / `INACTIVE` (`BR-004`, `FR-018`) and records an `AuditLog` entry. Returns `200 OK`.
* **UI Contract:**
  * Patient Service Catalog (`/patient/services`) displaying active medical services with duration badges (e.g., `30 mins`) and empty-state handling.
  * Admin Service Catalog Page (`/admin/services`) with Create/Edit Service Modal and status toggle controls.

### 1.5 F-005: Doctor-Service Assignment (Sprint 1 Secondary Domain Journey)

* **Mapped Requirements:** `FR-011`, `FR-017`; `BR-002`; `ASM-004`, `ASM-005`
* **Data Schema Contract (`DoctorService`, `AuditLog`):**
  * `DoctorService`: `doctor_service_id` (`UUID PK`), `doctor_id` (`UUID FK -> Doctor.doctor_id NOT NULL`), `service_id` (`UUID FK -> MedicalService.service_id NOT NULL`), `created_at` (`TIMESTAMPTZ UTC`). Constraint: `UNIQUE (doctor_id, service_id)`.
* **API Contract:**
  * `POST /api/v1/admin/doctors/:doctorId/services` (**ADMIN**): Accepts `{ serviceId }`. Validates both `doctorId` and `serviceId` exist (`404 Not Found` if missing) and inserts assignment. Rejects duplicate `(doctorId, serviceId)` pairs with `409 Conflict` (`DUPLICATE_ASSIGNMENT`). Returns `201 Created`.
  * `DELETE /api/v1/admin/doctors/:doctorId/services/:serviceId` (**ADMIN**): Removes assignment and logs action. Returns `200 OK`.
  * `GET /api/v1/doctors?serviceId=<uuid>` (**PATIENT, DOCTOR, ADMIN**): Filters doctors to return only `ACTIVE` doctors assigned to the specified `ACTIVE` service (`FR-017`, `BR-002`).
* **UI Contract:**
  * Admin Doctor-Service Assignment Drawer/Modal (`/admin/doctors`) allowing admins to assign/unassign services to a doctor with immediate feedback on duplicate errors.
  * Patient Service-to-Doctor Filter (`/patient/services` → `/patient/doctors?serviceId=...`) displaying only active doctors qualified for the selected service.

### 1.6 F-006: Doctor Self-Schedule Management (Sprint 1 Primary Domain Journey)

* **Mapped Requirements:** `FR-019`, `FR-020`, `FR-021`, `FR-022`; `BR-015`, `BR-016`, `BR-017`, `BR-020`, `BR-021`
* **Data Schema Contract (`DoctorSchedule`, `ScheduleException`):**
  * `DoctorSchedule`: `schedule_id` (`UUID PK`), `doctor_id` (`UUID FK -> Doctor.doctor_id NOT NULL`), `day_of_week` (`SMALLINT 0..6`), `start_time` (`TIME NOT NULL`), `end_time` (`TIME NOT NULL`, `CHECK (end_time > start_time)`), `is_active` (`BOOLEAN DEFAULT TRUE`), `created_at` (`TIMESTAMPTZ UTC`), `updated_at` (`TIMESTAMPTZ UTC`).
  * `ScheduleException`: `exception_id` (`UUID PK`), `doctor_id` (`UUID FK -> Doctor.doctor_id NOT NULL`), `exception_date` (`DATE NOT NULL`), `start_time` (`TIME NULLABLE`), `end_time` (`TIME NULLABLE`), `exception_type` (`ENUM: HOLIDAY, BREAK, UNAVAILABLE, CUSTOM_HOURS`), `reason` (`VARCHAR(255) NULLABLE`), `created_by` (`UUID FK -> User.user_id NOT NULL`), `created_at` (`TIMESTAMPTZ UTC`).
* **API Contract:**
  * `GET /api/v1/doctors/me/schedule` (**DOCTOR**): Resolves `doctorId` from authenticated `req.user.userId` and returns `{ weeklySchedules, exceptions }`.
  * `PUT /api/v1/doctors/me/schedule` (**DOCTOR**): Accepts `{ shifts: Array<{ dayOfWeek, startTime, endTime, isActive }> }`. Validates that for every shift `startTime < endTime` and no two active shifts on the same `dayOfWeek` overlap (`existing.start < incoming.end && incoming.start < existing.end`). Rejects invalid/overlapping windows with `422 Unprocessable Entity` (`INVALID_SCHEDULE_WINDOW`). Atomically replaces the doctor's weekly shifts with immediate effect (`DEC-006`). Returns `200 OK`.
  * `POST /api/v1/doctors/me/exceptions` (**DOCTOR**): Accepts `{ exceptionDate, exceptionType, startTime?, endTime?, reason? }`. Validates partial-day windows (`startTime < endTime`) or full-day `HOLIDAY` (`startTime = null, endTime = null`). Returns `201 Created`.
  * `DELETE /api/v1/doctors/me/exceptions/:exceptionId` (**DOCTOR**): Deletes exception owned by the authenticated doctor (`404 Not Found` if owned by another doctor). Returns `200 OK`.
* **UI Contract:**
  * Doctor Schedule Manager (`/doctor/schedule`) featuring a 7-day weekly working hours builder (supporting split shifts for lunch breaks), inline conflict/validation error banner, and an Exception Manager for adding holidays, breaks, or custom hours.

### 1.7 F-007: Administrator Schedule & Clinic Configuration

* **Mapped Requirements:** `FR-047`, `FR-048`; `BR-020`, `BR-021`, `BR-023`; `NFR-015`, `NFR-027`; `DEC-008`, `DEC-010`, `DEC-016`
* **Data Schema Contract (`ClinicSetting`, `DoctorSchedule`, `ScheduleException`, `AuditLog`):**
  * `ClinicSetting`: `setting_id` (`UUID PK`), `clinic_name` (`VARCHAR(150) NOT NULL`), `timezone` (`VARCHAR(64) DEFAULT 'Asia/Bangkok'`), `fixed_start_interval_minutes` (`INTEGER DEFAULT 15`, `CHECK (fixed_start_interval_minutes IN (5, 10, 15, 20, 30, 60))`), `cancellation_cutoff_hours` (`INTEGER DEFAULT 24`, `CHECK (cancellation_cutoff_hours >= 0)`), `reminder_lead_hours` (`INTEGER DEFAULT 24`, `CHECK (reminder_lead_hours > 0)`), `updated_by` (`UUID FK -> User.user_id NULLABLE`), `updated_at` (`TIMESTAMPTZ UTC`).
* **API Contract:**
  * `GET /api/v1/admin/doctors/:doctorId/schedule` (**ADMIN**): Retrieves weekly schedule and exceptions for any specified doctor.
  * `PUT /api/v1/admin/doctors/:doctorId/schedule` (**ADMIN**): Updates any doctor's weekly schedule (validating non-overlapping windows) and writes an `AuditLog` entry (`ADMIN_SCHEDULE_UPDATE`). Returns `200 OK`.
  * `POST /api/v1/admin/doctors/:doctorId/exceptions` (**ADMIN**): Creates a date-specific exception or override for a doctor with recorded reason in `AuditLog`. Returns `201 Created`.
  * `GET /api/v1/settings/public` (**Public / Authenticated**): Returns `{ clinicName, timezone, fixedStartIntervalMinutes, cancellationCutoffHours }`.
  * `PATCH /api/v1/admin/settings` (**ADMIN**): Updates clinic configuration fields (`clinicName`, `timezone`, `fixedStartIntervalMinutes`, `cancellationCutoffHours`, `reminderLeadHours`), validates IANA timezone string, and records an `AuditLog` entry (`CLINIC_SETTINGS_UPDATED`). Returns `200 OK`.
* **UI Contract:**
  * Admin Doctor Schedule Governance Page (`/admin/schedules`) with doctor selector dropdown and full weekly/exception editor.
  * Admin Clinic Settings Page (`/admin/settings`) allowing configuration of clinic name, timezone (`Asia/Bangkok`), fixed start interval (`15` mins), and cancellation cutoff (`24` hours).

---

## 2. Measurable Acceptance Criteria (Positive, Negative & Boundary Cases)

### 2.1 F-001: Authentication & Role Management
* **AC-F001-01 (Positive — Login, Identity Retrieval & Logout):** Given a seeded active user (`DOCTOR` or `ADMIN`), when submitting valid credentials to `POST /api/v1/auth/login`, then the API returns `200 OK` with `HttpOnly` session cookies, `GET /api/v1/auth/me` returns the matching user role, and `POST /api/v1/auth/logout` clears the cookies and revokes the refresh token so subsequent `/auth/me` requests return `401 Unauthorized`.
* **AC-F001-02 (Negative — Invalid Credentials & Unauthenticated Access):** Submitting an incorrect password or unknown email to `POST /api/v1/auth/login` returns `401 Unauthorized` without revealing account existence. Requesting `GET /api/v1/doctors/me/schedule` without cookies returns `401 Unauthorized`.
* **AC-F001-03 (Negative — Backend RBAC Privilege Escalation):** Given a user authenticated as `PATIENT` or `DOCTOR`, when sending a request to any `/api/v1/admin/*` endpoint, then the backend Role Guard rejects the request with `403 Forbidden`.
* **AC-F001-04 (Boundary — Inactive Account Login):** Given a seeded user with `account_status = 'INACTIVE'`, when attempting to log in via `POST /api/v1/auth/login`, the backend rejects authentication with `403 Forbidden` (`ACCOUNT_INACTIVE`).

### 2.2 F-002: Patient Profile Management
* **AC-F002-01 (Positive — Self Profile View & Update):** Given an authenticated `PATIENT`, when calling `GET /api/v1/patients/me` and updating `fullName` and `phoneNumber` via `PUT /api/v1/patients/me`, then PostgreSQL persists the updated values and returns `200 OK`.
* **AC-F002-02 (Negative — Role & Ownership Restriction):** Given a `DOCTOR` calls `PUT /api/v1/patients/me`, the backend returns `403 Forbidden`. Given Patient A attempts to query `/api/v1/admin/patients`, the backend returns `403 Forbidden` without returning other patients' data.
* **AC-F002-03 (Boundary — Empty Mandatory Fields & Future DOB):** Submitting an empty `fullName`, invalid phone format, or `dateOfBirth` set to tomorrow (`current_date + 1 day`) is rejected with `400 Bad Request`.

### 2.3 F-003: Doctor Profile Management
* **AC-F003-01 (Positive — Doctor Creation & Active Listing):** Given an `ADMIN` creates a Doctor with `profile_status = 'ACTIVE'`, when a `PATIENT` calls `GET /api/v1/doctors`, then the doctor appears with specialty metadata and the password is stored as an Argon2id hash.
* **AC-F003-02 (Negative — Deactivated Doctor Filtering):** Given an `ADMIN` sets a doctor's `profile_status` to `INACTIVE` via `PATCH /api/v1/admin/doctors/:id/status`, when a `PATIENT` calls `GET /api/v1/doctors`, then the inactive doctor is excluded (`FR-013`, `BR-003`).
* **AC-F003-03 (Boundary — Duplicate Email & Specialization Length):** Creating a doctor with an email already used by another `User` returns `409 Conflict`; `specialization` of 150 characters succeeds, whereas 151 characters returns `400 Bad Request`.

### 2.4 F-004: Medical Service Catalog
* **AC-F004-01 (Positive — Service Creation & Listing):** Given an `ADMIN` creates a service with `durationMinutes = 30` and `service_status = 'ACTIVE'`, when a `PATIENT` queries `GET /api/v1/services`, the active service is returned.
* **AC-F004-02 (Negative — Inactive Service Exclusion):** Given a service is updated to `INACTIVE`, when a `PATIENT` queries `GET /api/v1/services`, the inactive service is excluded (`FR-018`, `BR-004`).
* **AC-F004-03 (Boundary — Duration Lower & Upper Bounds):** Setting `durationMinutes = 0`, `-10`, or `481` returns `400 Bad Request`; setting `durationMinutes = 1` or `480` succeeds (`201 Created`).

### 2.5 F-005: Doctor-Service Assignment
* **AC-F005-01 (Positive — Assignment & Filtered Retrieval):** Given `ADMIN` assigns Doctor D1 to Service S1 (`POST /api/v1/admin/doctors/:d1/services`), when `PATIENT` calls `GET /api/v1/doctors?serviceId=S1`, then Doctor D1 is returned and doctors not assigned to S1 are excluded (`FR-017`, `BR-002`).
* **AC-F005-02 (Negative — Duplicate Assignment Rejection):** Given Doctor D1 is already assigned to Service S1, when `ADMIN` submits the identical `(D1, S1)` assignment again, then the API rejects it with `409 Conflict` (`DUPLICATE_ASSIGNMENT`).
* **AC-F005-03 (Boundary — Zero Assigned Doctors):** Querying `GET /api/v1/doctors?serviceId=S_EMPTY` for an active service with 0 assigned doctors returns `200 OK` with `data: []` and renders an empty state in the UI.

### 2.6 F-006: Doctor Self-Schedule Management
* **AC-F006-01 (Positive — Immediate Split-Shift Persistence):** Given an authenticated `DOCTOR` submits Monday shifts `09:00–12:00` and `13:00–17:00` via `PUT /api/v1/doctors/me/schedule`, then the backend persists both windows immediately (`200 OK`) and a subsequent `GET /api/v1/doctors/me/schedule` returns the exact saved windows.
* **AC-F006-02 (Negative — Overlapping or Inverted Shift Windows):** Given a `DOCTOR` submits overlapping Monday shifts (`09:00–13:00` and `12:00–16:00`) or an inverted shift (`14:00–10:00`), then the backend rejects the request with `422 Unprocessable Entity` (`INVALID_SCHEDULE_WINDOW`) and leaves existing schedules unaltered.
* **AC-F006-03 (Boundary — Adjacent Shifts & Full-Day Holiday Exception):** Adjacent shifts (`09:00–12:00` and `12:00–15:00`) are accepted (`200 OK`). Adding a `HOLIDAY` exception with `startTime = null` and `endTime = null` succeeds (`201 Created`) and blocks the entire date.

### 2.7 F-007: Administrator Schedule & Clinic Configuration
* **AC-F007-01 (Positive — Admin Schedule Override & Clinic Settings Update):** Given an `ADMIN` updates Doctor D1's schedule or updates `ClinicSetting` (`fixedStartIntervalMinutes = 15`, `cancellationCutoffHours = 24`, `timezone = 'Asia/Bangkok'`), then PostgreSQL persists the update (`200 OK`) and inserts a corresponding `AuditLog` record.
* **AC-F007-02 (Negative — Unauthorized Settings Access & Invalid Timezone):** A `DOCTOR` calling `PATCH /api/v1/admin/settings` receives `403 Forbidden`. An `ADMIN` submitting an invalid IANA timezone (`'Mars/Olympus'`) receives `400 Bad Request`.
* **AC-F007-03 (Boundary — Interval & Cutoff Lower Bounds):** Setting `fixedStartIntervalMinutes = 0` or unsupported interval `7` returns `400 Bad Request`. Setting `cancellationCutoffHours = 0` is accepted (`200 OK`); `-1` is rejected (`400 Bad Request`).

---

## 3. Software Test Specification (STS) — Sprint 1 Verification Plan

### 3.1 Multi-Tier Testing Strategy

1. **Unit Tests (`server/tests/sprint-1/unit/`):** Verify Argon2id password hashing/verification, JWT cookie signing/expiry, schedule window overlap detection logic, and UTC ↔ `Asia/Bangkok` conversion utilities in isolation.
2. **API & Database Integration Tests (`server/tests/sprint-1/integration/`):** Execute Supertest HTTP assertions against the Express app connected to a local PostgreSQL 16 test database with Prisma migrations and seed data applied, verifying persistence, rule rejections, and RBAC guards.
3. **End-to-End UI Tests (`client/tests/sprint-1/e2e/`):** Execute Playwright browser journeys covering login/logout, doctor self-schedule persistence, overlapping shift UI error feedback, and admin doctor-service assignment.

### 3.2 Sprint 1 Test Case Catalog (Mapped to Acceptance Criteria)

| Test ID | Linked AC | Level | Preconditions / Input | Action & Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **STS-S1-001** | AC-F001-01, AC-F001-04 | API + E2E | Seeded `ACTIVE` Doctor and `INACTIVE` User accounts exist in PostgreSQL | `POST /api/v1/auth/login` with valid active credentials sets `HttpOnly` cookies (`200 OK`), `GET /auth/me` returns role, `POST /auth/logout` revokes session (`401` on subsequent `/auth/me`); `INACTIVE` user login returns `403 ACCOUNT_INACTIVE`. |
| **STS-S1-002** | AC-F001-02 | API | Unauthenticated client; invalid password payload | `POST /api/v1/auth/login` with wrong password returns `401 Unauthorized`; `GET /api/v1/doctors/me/schedule` without cookie returns `401 Unauthorized`. |
| **STS-S1-003** | AC-F001-03, AC-F002-02 | API | Authenticated `PATIENT` and `DOCTOR` JWT cookies | Requests to `POST /api/v1/admin/services`, `GET /api/v1/admin/patients`, and `PATCH /api/v1/admin/settings` are rejected with `403 Forbidden`. |
| **STS-S1-004** | AC-F002-01, AC-F002-03 | API + E2E | Authenticated `PATIENT` (`patient.arisa@appointly.local`) | `PUT /api/v1/patients/me` with valid `fullName` & `phoneNumber` persists to DB (`200 OK`); empty `fullName` or future `dateOfBirth` returns `400 Bad Request`. |
| **STS-S1-005** | AC-F003-01, AC-F003-02, AC-F003-03 | API | Authenticated `ADMIN` and `PATIENT` | Admin creates Doctor (`201`), Password stored as Argon2id hash; Admin toggles doctor to `INACTIVE` (`200`), and `PATIENT` `GET /api/v1/doctors` excludes the inactive doctor. |
| **STS-S1-006** | AC-F004-01, AC-F004-02, AC-F004-03 | API | Authenticated `ADMIN` and `PATIENT` | Admin creates Service (`durationMinutes = 30` -> `201`), boundary `durationMinutes = 0` or `481` rejected (`400`), deactivated service hidden from Patient `GET /api/v1/services`. |
| **STS-S1-007** | AC-F005-01, AC-F005-02, AC-F005-03 | API + E2E | Active Doctor D1, Active Service S1, Active Service S_EMPTY | Admin assigns `(D1, S1)` (`201`), duplicate `(D1, S1)` rejected (`409 DUPLICATE_ASSIGNMENT`), `GET /api/v1/doctors?serviceId=S1` returns `[D1]`, `serviceId=S_EMPTY` returns `[]`. |
| **STS-S1-008** | AC-F006-01, AC-F006-02, AC-F006-03 | Unit + API + E2E | Authenticated `DOCTOR` | `PUT /api/v1/doctors/me/schedule` with split shifts (`09:00–12:00`, `13:00–17:00`) persists (`200 OK`) and `GET /doctors/me/schedule` retrieves it; overlapping shift (`11:00–14:00`) rejected (`422 INVALID_SCHEDULE_WINDOW`); full-day `HOLIDAY` exception saved (`201`). |
| **STS-S1-009** | AC-F007-01, AC-F007-02, AC-F007-03 | API | Authenticated `ADMIN` | `PATCH /api/v1/admin/settings` updates interval (`15`) and cutoff (`0` boundary -> `200`, `-1` -> `400`), persists in PostgreSQL, and creates `AuditLog` entry with Admin `user_id` and UTC timestamp. |

---

## 4. Product & Sprint 1 Definition of Done (DoD)

### 4.1 Functional, Code & Security Gates (Deliverable 1)
1. **Contract Completeness:** All Sprint 1 capabilities (`F-001` to `F-007` within `DEC-017` baseline scope), data entities, API endpoints, and UI screens are implemented and backed by PostgreSQL persistence with zero mock stubs.
2. **Type Safety & Clean Local Build:** Both `client/` and `server/` compile cleanly (`npm run build` / `tsc --noEmit`) and pass linting with zero errors.
3. **Database Migrations & Reproducible Seed:** All Sprint 1 tables and constraints are captured in versioned Prisma migrations (`server/prisma/migrations/`) and `server/prisma/seed.ts` populates clean demo accounts and clinic defaults on a fresh PostgreSQL 16 database.
4. **Security & Privacy Compliance:** Passwords use Argon2id; JWT cookies use `HttpOnly` and `SameSite=Strict`; all protected endpoints enforce the 4-gate RBAC pipeline; zero real secrets, tokens, or passwords appear in Git, logs, or API error responses.

### 4.2 Testing, Git Workflow & Documentation Gates (Deliverable 1)
5. **Automated Verification & TDD Evidence:** 100% of Sprint 1 Unit, API/Database Integration, and Playwright E2E tests (`STS-S1-001` to `STS-S1-009`) pass locally against the release commit, with TDD fail-before/pass-after evidence retained for domain validation rules.
6. **Reviewed Git Workflow & Release Tag:** Every feature is tracked via a GitHub Issue, implemented on a feature branch, merged into `sprint-1-staging` via a **teammate-reviewed Pull Request** (authors never approve their own PRs), integrated, and merged into `main` with an immutable release tag/commit.
7. **Up-to-Date Documentation & Deployment Readiness:** `README.md` and `.env.example` document all dependencies, environment variables, and local setup/test commands. Packaging files (`Dockerfile`, `.dockerignore`) are prepared for Lab 5 cloud deployment (actual Docker/CI/CD pipeline execution and GCP deployment are verified in Lab 5).
8. **Transparent Disclosure:** Any known limitations or incomplete items are explicitly disclosed in Part F of the Deliverable 1 submission PDF.

---
*End of Appointly Sprint 1 Engineering Contracts — Version 1.0*