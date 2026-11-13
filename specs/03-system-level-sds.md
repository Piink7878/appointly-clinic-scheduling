# Appointly — System-Level Software Design Specification (SDS)

* **Product Name:** Appointly
* **System Name:** Clinic Appointment & Scheduling Management System
* **Document Version:** 1.0 — Deliverable 1 Baseline Confirmed
* **Reference Documents:** SRS & Product Scope v1.0; Feature Inventory & Traceability v1.0
* **Project Type:** Responsive Web Application
* **System Scope:** Single Clinic / Single Organization
* **Status:** Engineering Baseline Approved

---

## 1. System Architecture

### 1.1 Purpose & Scope

This document defines the system-level software architecture and technical design baseline for Appointly, covering system architecture, technology stack, relational data models, UI/API standards, Role-Based Access Control (RBAC), security and PDPA compliance, and configuration/delivery design.

It translates the confirmed requirements in SRS & Product Scope v1.0 (`FR-001` to `FR-050`, `BR-001` to `BR-033`, `NFR-001` to `NFR-027`, `DEC-001` to `DEC-017`) and Feature Inventory & Traceability v1.0 (`F-001` to `F-019`) into a unified technical blueprint for implementation and verification.

### 1.2 Architectural Style: Three-Tier Modular Monolith

Appointly adopts a Three-Tier Architecture with a Modular Monolithic Backend:

* **Presentation Layer:** Responsive Single-Page Web Application (React + TypeScript) providing role-scoped interfaces for Patients, Doctors, and Clinic Administrators.
* **Application Layer:** RESTful Backend API (Node.js + Express.js + TypeScript) structured into cohesive domain modules enforcing business rules, RBAC authorization, Hybrid Time Slot calculation, concurrency control, and notification dispatching.
* **Data Layer:** PostgreSQL relational database enforcing referential integrity, transactional atomicity, and database-level exclusion constraints.

### 1.3 Logical Architecture

```text
+------------------------------------------------------------------+
|                        Presentation Layer                        |
|                                                                  |
|    Patient Portal    |    Doctor Portal    |    Admin Portal     |
|                                                                  |
|            Responsive Web Application (React + TS)               |
+---------------------------------+--------------------------------+
                                  |
                            HTTPS (TLS 1.2+)
                                  |
+---------------------------------v--------------------------------+
|                        Application Layer                         |
|                                                                  |
|                 Modular Monolith REST API (/api/v1)              |
|                                                                  |
|  +----------------------+  +----------------------------------+  |
|  | Auth & RBAC          |  | User, Patient & Doctor Mgmt.     |  |
|  +----------------------+  +----------------------------------+  |
|                                                                  |
|  +----------------------+  +----------------------------------+  |
|  | Medical Service &    |  | Doctor Schedule, Conflict &      |  |
|  | Assignment Mgmt.     |  | Hybrid Time Slot Engine          |  |
|  +----------------------+  +----------------------------------+  |
|                                                                  |
|  +----------------------+  +----------------------------------+  |
|  | Appointment Engine   |  | Dual Notification Dispatcher     |  |
|  | (Atomic + Idempotent)|  | (In-App + Email + Retry Worker)  |  |
|  +----------------------+  +----------------------------------+  |
|                                                                  |
|  +----------------------+  +----------------------------------+  |
|  | Clinic Configuration |  | Clinic Dashboard & Reports       |  |
|  +----------------------+  +----------------------------------+  |
+---------------------------------+--------------------------------+
                                  |
+---------------------------------v--------------------------------+
|                           Data Layer                             |
|                                                                  |
|                      PostgreSQL Database                         |
|                                                                  |
|  Users | Patients | Doctors | MedicalServices | DoctorServices   |
|  DoctorSchedules | ScheduleExceptions | Appointments             |
|  AppointmentHistory | Notifications | ClinicSettings | AuditLogs |
+---------------------------------+--------------------------------+
                                  |
+---------------------------------v--------------------------------+
|                  External Service Integration                    |
|                                                                  |
|  Transactional Email Provider (SMTP/API)  |  System Clock (UTC)  |
+------------------------------------------------------------------+
```

### 1.4 Architectural Components

| Component | Mapped Modules / Features | Core Technical Responsibility |
| :--- | :--- | :--- |
| **Patient Portal** | M01, M02, M06, M07 / F-001, F-002, F-010, F-013, F-014, F-016 | Authentication, profile management, browsing active services/doctors, guided booking flow, rescheduling/cancellation, and in-app notifications |
| **Doctor Portal** | M01, M05, M06 / F-001, F-006, F-008, F-013, F-015 | Personal schedule & exception configuration (immediate effect when conflict-free), assigned appointment dashboard, and status updates (Completed/No-show) |
| **Administrator Portal** | M01–M08 / F-001–F-005, F-007, F-008, F-012–F-015, F-018, F-019 | Clinic-wide governance over doctors, services, assignments, all schedules, policy overrides, admin-assisted booking, clinic settings, dashboard, and reports |
| **Auth & RBAC Module** | M01 / F-001 | Argon2id password hashing, JWT Access/Refresh token issuance via HttpOnly cookies, current-user retrieval (`/auth/me`), session revocation, and route/resource RBAC middleware |
| **Schedule & Slot Engine** | M05, M06 / F-006–F-009 | Weekly schedule & exception evaluation, conflict detection against confirmed bookings, and 15-minute default Hybrid Time Slot generation in UTC/local timezone |
| **Appointment Engine** | M06 / F-010–F-015 | Atomic PostgreSQL transactions, GiST exclusion-based double-booking prevention, idempotency enforcement, cutoff validation (24h default), and immutable audit history |
| **Notification Module** | M07 / F-016, F-017 | Decoupled In-App and Email notification dispatching, delivery status tracking (Pending/Sent/Failed), scheduled reminders, and exponential-backoff retries |
| **Dashboard & Reports** | M08 / F-018, F-019 | Real-time status aggregations (Confirmed, Completed, Cancelled, No-show), upcoming appointment feeds, and custom date-range statistical queries |

### 1.5 Core System Workflows & Architectural Constraints

* **Authoritative Backend Validation:** The backend REST API is the sole source of truth for slot availability, cutoff enforcement, and conflict detection; frontend slot states are advisory only.
* **Unified Booking Pipeline:** Both Patient self-service booking (`F-010`) and Administrator-assisted booking (`F-012`) execute the exact same availability revalidation, idempotency check, and atomic PostgreSQL transaction.
* **Instant Confirmation Model:** Valid bookings transition immediately to `CONFIRMED` upon database commit without a manual approval queue.
* **Schedule Conflict Governance:** Doctor self-schedule updates apply immediately when no confirmed appointments overlap; conflicting changes are blocked unless resolved or overridden by a Clinic Administrator with a mandatory recorded reason.
* **Notification Isolation:** Notification persistence and email delivery execute outside the booking commit boundary so transient email provider failures never roll back a confirmed appointment.
* **Historical Snapshot Integrity:** Appointments store `service_name_snapshot` and `duration_minutes_snapshot` at booking time so historical records remain immutable if service catalog details change or are deactivated later.

---

## 2. Technology Stack & Project Structure

### 2.1 Confirmed Technology Stack

| Layer | Technology | Version / Specification | Engineering Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend (`client/`)** | React + TypeScript + Vite | React 18+ / TypeScript 5+ | Component-based SPA architecture with strict static typing |
| **UI Styling** | Tailwind CSS | v3+ | Utility-first responsive styling for desktop, tablet, and mobile viewports |
| **Backend (`server/`)** | Node.js + Express.js + TypeScript | Node.js 20 LTS / Express 4+ | Lightweight, modular REST API with shared TypeScript domain types |
| **Database** | PostgreSQL | PostgreSQL 16+ (with `btree_gist`) | ACID transactions, row-level locking, and GiST exclusion constraints for overlap prevention |
| **ORM & Migrations** | Prisma ORM | Prisma 5+ | Type-safe database queries, declarative schema, and versioned migrations |
| **Authentication** | JWT (Access + Refresh Tokens) in HttpOnly Cookies | Short-lived Access Token (15m) + Rotating Refresh Token (7d) | Stateless API authorization paired with XSS-safe HttpOnly/Secure/SameSite cookie storage and server-side refresh revocation |
| **Password Hashing** | Argon2id | OWASP-compliant parameters | Memory-hard cryptographic hashing resistant to GPU/ASIC brute-force attacks |
| **API Specification** | OpenAPI 3.1 / Swagger | RESTful JSON over HTTPS | Standardized API contract documentation and schema validation |
| **Containerization & Cloud (Lab 5)** | Docker + GitHub Actions + GCP | Cloud Run, Cloud SQL (PostgreSQL 16), Artifact Registry, Secret Manager | Reproducible container builds, automated CI checks, and serverless GCP persistence |
| **Reverse Proxy** | Nginx (`client/nginx.conf`) | TLS 1.2 / 1.3 | SPA routing, security headers, and API reverse proxying |

### 2.2 Monorepo Root & Documentation Structure

The repository integrates the engineering specifications (`specs/`) alongside `client/`, `server/`, `deploy/`, and `docs/labs/lab-05/deployment.md`.

```text
appointly-monorepo/
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── README.md                            # Local setup, env vars, migrations, seed & test commands
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       ├── ci-docker.yml                # [Lab 5] Automated build, tests & Docker image check
│       └── deploy.yml                   # [Lab 5] Automated GCP Cloud Run deployment pipeline
├── deploy/
│   ├── deploy.sh                        # [Lab 5] GCP Cloud Run & Cloud SQL deployment script
│   ├── release.sh                       # [Lab 5] Commit SHA image tag & digest release script
│   ├── smoke_test.py                    # [Lab 5] Post-deployment live URL health & smoke test
│   └── teardown.sh                      # [Lab 5] Cloud resource cleanup script
├── docs/
│   └── labs/
│       └── lab-05/
│           └── deployment.md            # [Lab 5] Cloud architecture, env vars & release runbook
├── specs/                               # Engineering Baseline Specifications
│   ├── 01-srs-and-product-scope.md      # Part A: SRS & Product Scope (v1.0)
│   ├── 02-feature-inventory-traceability.md # Part B: Feature Inventory & Traceability (v1.0)
│   ├── 03-system-level-sds.md           # Part C: System-Level SDS (v1.0)
│   ├── 04-three-sprint-plan.md          # Part D: Three-Sprint Implementation Plan (v1.0)
│   ├── api/
│   │   └── openapi.yaml                 # OpenAPI 3.1 REST API contract
│   └── sprints/
│       ├── sprint-1-contracts.md        # Part E: Sprint 1 Engineering Contracts (v1.0)
│       ├── sprint-2-contracts.md        # Sprint 2 Engineering Contracts
│       └── sprint-3-contracts.md        # Sprint 3 Engineering Contracts
├── client/                              # React + TypeScript Frontend SPA
└── server/                              # Node.js + Express + TypeScript + Prisma Backend API
```

### 2.3 Frontend Directory Structure (`client/`)

```text
client/
├── .env.example
├── Dockerfile
├── nginx.conf
├── package.json
├── tsconfig.json
├── tests/                               # Sprint-partitioned frontend test suite
│   ├── sprint-1/
│   ├── sprint-2/
│   └── sprint-3/
└── src/
    ├── shared/                          # Shared Core Across All Sprints
    │   ├── api/                         # HTTP client, cookie credentials & error normalizer
    │   ├── components/                  # Reusable UI system (Buttons, Modals, Tables, Badges, Toast)
    │   ├── context/                     # Global AuthContext, RoleGuard & TimezoneContext
    │   ├── hooks/                       # Shared hooks (useAuth, useTimezone)
    │   ├── layouts/                     # PatientLayout, DoctorLayout, AdminLayout
    │   ├── types/                       # Shared TypeScript DTOs, Role enums & API envelopes
    │   └── utils/                       # UTC <-> Asia/Bangkok date formatters & validators
    ├── modules/                         # Domain Feature Modules (Annotated by Sprint Delivery)
    │   ├── auth/                        # [S1: F-001] Login & Session Shell ([S2] Registration/Password)
    │   ├── patients/                    # [S1: F-002] Patient Profile & Admin Patient Directory UI
    │   ├── doctors/                     # [S1: F-003] Doctor Profile & Specialty Management UI
    │   ├── services/                    # [S1: F-004, F-005] Service Catalog & Doctor-Service Assignment UI
    │   ├── schedules/                   # [S1: F-006, F-007] Doctor Self-Schedule & Exception Manager UI
    │   ├── settings/                    # [S1: F-007] Clinic Settings Management UI
    │   ├── appointments/                # [S2: F-008–F-015] Slot Selector, Booking Wizard, Reschedule/Cancel UI
    │   ├── notifications/               # [S3: F-016, F-017] In-App Notification Center UI
    │   └── reports/                     # [S3: F-018, F-019] Clinic Dashboard & Date-Range Reports UI
    ├── router/                          # Application router mounting role-protected routes
    └── App.tsx
```

### 2.4 Backend Directory Structure (`server/`)

```text
server/
├── .env.example
├── Dockerfile
├── docker-entrypoint.sh
├── package.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma                    # Unified PostgreSQL schema & GiST exclusion constraint
│   ├── migrations/                      # Versioned SQL migrations across Sprints 1–3
│   └── seed.ts                          # Idempotent synthetic seed data for local & staging setup
├── tests/                               # Sprint-partitioned backend test suite
│   ├── sprint-1/
│   ├── sprint-2/
│   └── sprint-3/
└── src/
    ├── shared/                          # Shared Backend Core Across All Sprints
    │   ├── config/                      # Environment variable validation & clinic default constants
    │   ├── database/                    # Prisma client singleton & transaction runner
    │   ├── middleware/                  # JWT cookie auth guard, RBAC guard, rate limiter, error handler
    │   ├── types/                       # Shared domain interfaces & Express request extensions
    │   └── utils/                       # Argon2id helper, UTC/timezone converter, PII-safe logger
    ├── modules/                         # Domain Feature Modules (Annotated by Sprint Delivery)
    │   ├── auth/                        # [S1: F-001] Login, Logout, /me, JWT rotation & RBAC
    │   ├── patients/                    # [S1: F-002] Patient profile & admin directory module
    │   ├── doctors/                     # [S1: F-003] Doctor profile & active status module
    │   ├── services/                    # [S1: F-004, F-005] Medical service catalog & doctor-service assignment
    │   ├── schedules/                   # [S1: F-006, F-007] Weekly working hours, breaks & schedule exceptions
    │   ├── settings/                    # [S1: F-007] ClinicSetting management (timezone, interval, cutoff)
    │   ├── appointments/                # [S2: F-008–F-015] Conflict validator, slot engine, booking & history
    │   ├── notifications/               # [S3: F-016, F-017] In-App + Email dispatcher & retry worker
    │   └── reports/                     # [S3: F-018, F-019] Dashboard metrics & date-range reports
    ├── routes/                          # Mounts /api/v1 endpoints across modules
    ├── app.ts
    └── server.ts
```

---

## 3. Data Models & Database Design

### 3.1 Relational Modeling Principles

* All primary keys use UUIDs (`uuid`) to prevent enumeration attacks across API endpoints.
* All date-time fields use `TIMESTAMPTZ` stored in UTC and formatted in the clinic's configured local timezone (default: `Asia/Bangkok`, UTC+7) at the presentation boundary.
* Authentication credentials (`User`) are separated from role-specific profiles (`Patient`, `Doctor`).
* Clinical/medical records (EMR, diagnoses, prescriptions, lab results) are strictly excluded per Scope Boundaries.

### 3.2 Core Database Entities

#### A. User
Stores shared authentication credentials and role assignments for all system users.

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `user_id` | `UUID (PK)` | Unique user identifier |
| `email` | `VARCHAR(255) (UNIQUE, NOT NULL)` | Normalized lowercase login email |
| `password_hash` | `VARCHAR(255) (NOT NULL)` | Argon2id cryptographic password hash |
| `role` | `ENUM('PATIENT', 'DOCTOR', 'ADMIN')` | Primary RBAC role |
| `account_status` | `ENUM('ACTIVE', 'INACTIVE')` | Account activation state |
| `refresh_token_hash` | `VARCHAR(255) (NULLABLE)` | Hashed active refresh token for rotation/revocation |
| `created_at` | `TIMESTAMPTZ (NOT NULL)` | UTC creation timestamp |
| `updated_at` | `TIMESTAMPTZ (NOT NULL)` | UTC last update timestamp |

#### B. Patient
Stores essential demographic and contact data for registered patients. *Must not contain diagnosis, treatment, prescription, or laboratory result information.*

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `patient_id` | `UUID (PK)` | Unique patient identifier |
| `user_id` | `UUID (FK -> User.user_id, UNIQUE)` | Associated authentication account |
| `full_name` | `VARCHAR(150) (NOT NULL)` | Patient full name |
| `phone_number` | `VARCHAR(30) (NOT NULL)` | Primary contact phone number |
| `date_of_birth` | `DATE (NULLABLE)` | Date of birth |
| `created_at` | `TIMESTAMPTZ (NOT NULL)` | UTC creation timestamp |
| `updated_at` | `TIMESTAMPTZ (NOT NULL)` | UTC last update timestamp |

#### C. Doctor
Stores medical provider profile metadata and booking eligibility status.

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `doctor_id` | `UUID (PK)` | Unique doctor identifier |
| `user_id` | `UUID (FK -> User.user_id, UNIQUE)` | Associated authentication account |
| `full_name` | `VARCHAR(150) (NOT NULL)` | Doctor full name |
| `specialization` | `VARCHAR(150) (NOT NULL)` | Clinical specialty or area of expertise |
| `professional_license_number` | `VARCHAR(100) (NULLABLE)` | Medical license identifier |
| `profile_status` | `ENUM('ACTIVE', 'INACTIVE')` | Controls eligibility for new bookings (`BR-003`) |
| `created_at` | `TIMESTAMPTZ (NOT NULL)` | UTC creation timestamp |
| `updated_at` | `TIMESTAMPTZ (NOT NULL)` | UTC last update timestamp |

#### D. MedicalService
Stores the clinic's catalog of billable/schedulable outpatient services.

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `service_id` | `UUID (PK)` | Unique service identifier |
| `service_name` | `VARCHAR(150) (UNIQUE, NOT NULL)` | Name of the medical service |
| `description` | `TEXT (NULLABLE)` | Service overview displayed to patients |
| `duration_minutes` | `INTEGER (CHECK > 0, NOT NULL)` | Fixed service duration in minutes |
| `service_status` | `ENUM('ACTIVE', 'INACTIVE')` | Controls eligibility for new bookings (`BR-004`) |
| `created_at` | `TIMESTAMPTZ (NOT NULL)` | UTC creation timestamp |
| `updated_at` | `TIMESTAMPTZ (NOT NULL)` | UTC last update timestamp |

#### E. DoctorService
Join entity modeling the many-to-many assignment between doctors and medical services.  
*Constraint:* `UNIQUE (doctor_id, service_id)` prevents duplicate assignments.

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `doctor_service_id` | `UUID (PK)` | Unique assignment identifier |
| `doctor_id` | `UUID (FK -> Doctor.doctor_id, NOT NULL)` | Assigned doctor |
| `service_id` | `UUID (FK -> MedicalService.service_id, NOT NULL)` | Assigned medical service |
| `created_at` | `TIMESTAMPTZ (NOT NULL)` | UTC assignment timestamp |

#### F. DoctorSchedule
Stores recurring weekly working windows for each doctor. Multiple rows per `day_of_week` are supported to represent split shifts (e.g., morning and afternoon sessions separated by a lunch break).

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `schedule_id` | `UUID (PK)` | Unique schedule window identifier |
| `doctor_id` | `UUID (FK -> Doctor.doctor_id, NOT NULL)` | Associated doctor |
| `day_of_week` | `SMALLINT (0–6, NOT NULL)` | Day of week (`0` = Sunday to `6` = Saturday) |
| `start_time` | `TIME (NOT NULL)` | Shift start time in clinic local timezone |
| `end_time` | `TIME (NOT NULL)` | Shift end time in clinic local timezone (`end_time > start_time`) |
| `is_active` | `BOOLEAN (DEFAULT TRUE)` | Whether this recurring window is active |
| `created_at` | `TIMESTAMPTZ (NOT NULL)` | UTC creation timestamp |
| `updated_at` | `TIMESTAMPTZ (NOT NULL)` | UTC last update timestamp |

#### G. ScheduleException
Stores date-specific schedule overrides, breaks, days off, and holidays that take precedence over recurring weekly schedules.

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `exception_id` | `UUID (PK)` | Unique exception identifier |
| `doctor_id` | `UUID (FK -> Doctor.doctor_id, NOT NULL)` | Associated doctor |
| `exception_date` | `DATE (NOT NULL)` | Specific calendar date affected |
| `start_time` | `TIME (NULLABLE)` | Window start time (`NULL` indicates full-day off/holiday) |
| `end_time` | `TIME (NULLABLE)` | Window end time (`NULL` indicates full-day off/holiday) |
| `exception_type` | `ENUM('HOLIDAY', 'BREAK', 'UNAVAILABLE', 'CUSTOM_HOURS')` | Categorizes unavailability vs. custom working hours |
| `reason` | `VARCHAR(255) (NULLABLE)` | Optional note or administrative override reason |
| `created_by` | `UUID (FK -> User.user_id, NOT NULL)` | Doctor or Administrator who created the record |
| `created_at` | `TIMESTAMPTZ (NOT NULL)` | UTC creation timestamp |

#### H. Appointment [Sprint 2]
Stores core appointment records, immutable service snapshots, and idempotency keys.

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `appointment_id` | `UUID (PK)` | Unique appointment identifier |
| `patient_id` | `UUID (FK -> Patient.patient_id, NOT NULL)` | Patient receiving the service |
| `doctor_id` | `UUID (FK -> Doctor.doctor_id, NOT NULL)` | Assigned doctor |
| `service_id` | `UUID (FK -> MedicalService.service_id, NOT NULL)` | Selected medical service |
| `service_name_snapshot` | `VARCHAR(150) (NOT NULL)` | Immutable service name captured at booking time |
| `duration_minutes_snapshot` | `INTEGER (NOT NULL)` | Immutable service duration captured at booking time |
| `start_datetime` | `TIMESTAMPTZ (NOT NULL)` | UTC appointment start timestamp |
| `end_datetime` | `TIMESTAMPTZ (NOT NULL)` | UTC appointment end timestamp (`start_datetime + duration_minutes_snapshot`) |
| `status` | `ENUM('CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')` | Current lifecycle status (defaults to `CONFIRMED`) |
| `idempotency_key` | `VARCHAR(128) (UNIQUE, NULLABLE)` | Client-generated key preventing duplicate bookings on network retries |
| `created_by` | `UUID (FK -> User.user_id, NOT NULL)` | Patient or Administrator who created the booking |
| `created_at` | `TIMESTAMPTZ (NOT NULL)` | UTC creation timestamp |
| `updated_at` | `TIMESTAMPTZ (NOT NULL)` | UTC last update timestamp |

#### I. AppointmentHistory [Sprint 2]
Immutable audit ledger recording every booking creation, reschedule, cancellation, status transition, and policy override.

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `history_id` | `UUID (PK)` | Unique history entry identifier |
| `appointment_id` | `UUID (FK -> Appointment.appointment_id, NOT NULL)` | Associated appointment |
| `changed_by` | `UUID (FK -> User.user_id, NOT NULL)` | Actor performing the action |
| `action_type` | `ENUM('CREATED', 'RESCHEDULED', 'CANCELLED', 'STATUS_UPDATED', 'ADMIN_OVERRIDE')` | Type of lifecycle event |
| `previous_status` | `ENUM('CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') (NULLABLE)` | Prior status |
| `new_status` | `ENUM('CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') (NOT NULL)` | Resulting status |
| `previous_start_datetime` | `TIMESTAMPTZ (NULLABLE)` | Prior UTC start timestamp (for reschedules) |
| `new_start_datetime` | `TIMESTAMPTZ (NOT NULL)` | Resulting UTC start timestamp |
| `override_reason` | `TEXT (NULLABLE)` | Mandatory explanation when an Administrator overrides cutoff/schedule rules |
| `changed_at` | `TIMESTAMPTZ (NOT NULL)` | UTC timestamp of change |

#### J. Notification [Sprint 3]
Stores both In-App and Email notification records, delivery status, and retry counters.

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `notification_id` | `UUID (PK)` | Unique notification identifier |
| `user_id` | `UUID (FK -> User.user_id, NOT NULL)` | Recipient user account |
| `appointment_id` | `UUID (FK -> Appointment.appointment_id, NOT NULL)` | Related appointment |
| `notification_type` | `ENUM('BOOKING_CONFIRMATION', 'RESCHEDULE', 'CANCELLATION', 'REMINDER')` | Event trigger category |
| `delivery_channel` | `ENUM('IN_APP', 'EMAIL')` | Delivery channel |
| `title` | `VARCHAR(200) (NOT NULL)` | Notification subject/headline |
| `message` | `TEXT (NOT NULL)` | Formatted notification body |
| `is_read` | `BOOLEAN (DEFAULT FALSE)` | Read indicator for `IN_APP` notifications |
| `delivery_status` | `ENUM('PENDING', 'SENT', 'FAILED')` | Delivery state |
| `retry_count` | `SMALLINT (DEFAULT 0)` | Number of delivery retry attempts |
| `scheduled_at` | `TIMESTAMPTZ (NOT NULL)` | Target dispatch timestamp in UTC |
| `sent_at` | `TIMESTAMPTZ (NULLABLE)` | Actual delivery timestamp in UTC |
| `created_at` | `TIMESTAMPTZ (NOT NULL)` | UTC creation timestamp |

#### K. ClinicSetting
Stores clinic-wide configurable operational parameters governed by Clinic Administrators.

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `setting_id` | `UUID (PK)` | Singleton configuration identifier |
| `clinic_name` | `VARCHAR(150) (NOT NULL)` | Official clinic display name |
| `timezone` | `VARCHAR(64) (DEFAULT 'Asia/Bangkok', NOT NULL)` | IANA timezone identifier (`DEC-016`) |
| `fixed_start_interval_minutes` | `INTEGER (DEFAULT 15, CHECK > 0)` | Candidate slot interval in minutes (`DEC-008`) |
| `cancellation_cutoff_hours` | `INTEGER (DEFAULT 24, CHECK >= 0)` | Minimum hours before appointment for patient cancel/reschedule (`DEC-010`) |
| `reminder_lead_hours` | `INTEGER (DEFAULT 24, CHECK > 0)` | Hours before appointment to dispatch scheduled reminders |
| `updated_by` | `UUID (FK -> User.user_id, NULLABLE)` | Last Administrator who updated settings |
| `updated_at` | `TIMESTAMPTZ (NOT NULL)` | UTC last update timestamp |

#### L. AuditLog
Records administrative overrides, account status toggles, and security-sensitive operations.

| Attribute | Type & Constraints | Description |
| :--- | :--- | :--- |
| `audit_id` | `UUID (PK)` | Unique audit log identifier |
| `user_id` | `UUID (FK -> User.user_id, NOT NULL)` | Actor performing the action |
| `action_type` | `VARCHAR(100) (NOT NULL)` | Standardized event code (e.g., `SCHEDULE_OVERRIDE`, `DOCTOR_DEACTIVATED`, `SETTINGS_UPDATED`) |
| `entity_type` | `VARCHAR(50) (NOT NULL)` | Target entity name |
| `entity_id` | `UUID (NOT NULL)` | Target record UUID |
| `details` | `JSONB (NULLABLE)` | Sanitized metadata and override reason |
| `created_at` | `TIMESTAMPTZ (NOT NULL)` | UTC timestamp |

### 3.3 Entity Relationship Diagram

```text
User (1) ────────── (0..1) Patient
  │
  ├──────────────── (0..1) Doctor
  │                          │
  │                          ├──< DoctorService >── MedicalService
  │                          ├──< DoctorSchedule
  │                          ├──< ScheduleException
  │                          └──< Appointment >──── Patient
  │                                  │    │
  │                                  │    └──────── MedicalService
  │                                  ├──< AppointmentHistory
  │                                  └──< Notification
  │
  ├──< Notification
  ├──< AuditLog
  └──< ClinicSetting (updated_by)
```

### 3.4 Database Setup, Migrations & Reproducible Seed Data

* **Schema & Migrations (`server/prisma/`):** All tables, enums, foreign keys, and `CHECK` constraints are defined in `server/prisma/schema.prisma` and applied sequentially via `npx prisma migrate dev` (local development) or `npx prisma migrate deploy` (automated staging/production migration job).
* **Reproducible Seed Data (`server/prisma/seed.ts`):** An idempotent `upsert`-based seed script provisions synthetic test accounts across all three roles (`admin@appointly.local`, `doctor.somchai@appointly.local`, `doctor.nida@appointly.local`, `patient.arisa@appointly.local`, `patient.krit@appointly.local`), initial medical services, doctor-service assignments, baseline weekly schedules, and the singleton `ClinicSetting` record (`Asia/Bangkok`, `15` min interval, `24` hr cutoff). Seed credentials are read from environment variables or documented in local setup instructions without hardcoding production secrets.

### 3.5 Concurrency Control & Double-Booking Prevention [Sprint 2]

To satisfy `BR-008`, `BR-009`, and `NFR-012` without race conditions under concurrent requests:

1. **PostgreSQL GiST Exclusion Constraint:** Using the `btree_gist` extension, the `Appointment` table enforces an exclusion constraint preventing overlapping time ranges (`tstzrange(start_datetime, end_datetime, '[)')`) for the same `doctor_id` whenever `status = 'CONFIRMED'`:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
ADD CONSTRAINT no_overlapping_confirmed_appointments
EXCLUDE USING gist (
  doctor_id WITH =,
  tstzrange(start_datetime, end_datetime, '[)') WITH &&
)
WHERE (status = 'CONFIRMED');
```

2. **Atomic Transaction & Revalidation:** Every booking and rescheduling operation executes inside an atomic database transaction that re-queries doctor schedules, exceptions, and active appointments before `INSERT`/`UPDATE`. Concurrent collisions raise PostgreSQL error `23P01`, translated into HTTP `409 Conflict` (`SLOT_UNAVAILABLE`).
3. **Request Idempotency:** Client booking requests include a UUID `Idempotency-Key` header; repeated submissions due to network timeouts return the original confirmed appointment rather than creating duplicates (`NFR-018`).

---

## 4. UI Design Standards

### 4.1 Core UI & UX Principles

* **Design System Consistency:** Unified typography, spacing scale, color tokens, and accessible contrast ratios (WCAG 2.1 AA).
* **Role-Scoped Navigation:** Dedicated navigation shells for Patient, Doctor, and Administrator portals so users see only authorized workflows.
* **Authoritative Backend Feedback:** Slot availability indicators update dynamically, and validation or conflict errors display clear inline alerts.
* **Emergency Disclaimer:** Public and booking views display a clear notice advising patients experiencing medical emergencies to contact emergency services rather than booking online.

### 4.2 Role-Based Portal Structure

* **Patient Portal:** `[S1]` Active Service Catalog & Eligible Doctor Directory → `[S1]` Personal Profile View/Edit → `[S2]` Date & Hybrid Time Slot Picker → Booking Summary & Instant Confirmation → My Appointments (Upcoming/Past, Reschedule/Cancel) → `[S3]` In-App Notifications.
* **Doctor Portal:** `[S1]` Self-Schedule & Exception Manager (Weekly Shifts, Split Shifts, Holidays) → `[S2]` Daily/Weekly Assigned Schedule Dashboard → Appointment Detail Drawer → Status Action Controls (`Completed` / `No-show`).
* **Administrator Portal:** `[S1]` Doctor & Service Catalog Management → `[S1]` Doctor-Service Assignment Matrix → `[S1]` Clinic-Wide Doctor Schedule & Override Manager → `[S1]` Patient Directory & Clinic Configuration Settings → `[S2]` All Appointments Manager & Admin-Assisted Booking Wizard → `[S3]` Clinic Overview Dashboard & Date-Range Reports.

### 4.3 Standard UI Components & States

| Component | Standard Behavior |
| :--- | :--- |
| **Slot Picker** | Visually distinguishes *Available*, *Selected*, *Unavailable*, and *Past* candidate slots generated at the configured interval (default: 15 min) |
| **Status Badge** | Consistent semantic styling for `CONFIRMED` / `ACTIVE` (Blue/Green), `COMPLETED` (Green), `CANCELLED` / `INACTIVE` (Gray/Red), and `NO_SHOW` (Amber) |
| **Confirmation Modal** | Required for destructive or policy-sensitive actions (cancellation, rescheduling, schedule deactivation, and admin overrides with reason input) |
| **Toast / Alert Banner** | Displays immediate success confirmations and actionable backend validation error messages |
| **Responsive Tables & Cards** | Multi-column tables on desktop adapt cleanly to stacked cards on tablet and mobile viewports (`NFR-022`) |
| **Loading & Empty States** | Display skeleton/spinner indicators during asynchronous API fetches and clear, guided empty-state messages when no records, doctors, or slots are available (`NFR-020`) |

---

## 5. API Design Standards

### 5.1 RESTful API Conventions

* **Base Path:** `/api/v1` over HTTPS (TLS 1.2+ in production; HTTP on localhost).
* **Payload Format:** `application/json` using `camelCase` JSON keys and ISO 8601 UTC timestamps (`YYYY-MM-DDTHH:mm:ssZ`).
* **Health Check Endpoints:** `GET /api/v1/health` (liveness) and `GET /api/v1/ready` (database connectivity check).

### 5.2 Representative API Endpoints

| Method | Endpoint | Sprint | Allowed Roles | Description |
| :--- | :--- | :---: | :--- | :--- |
| `POST` | `/api/v1/auth/login` | S1 | Public | Authenticate user and set HttpOnly Access/Refresh cookies |
| `GET` | `/api/v1/auth/me` | S1 | Authenticated | Retrieve current authenticated user identity and role |
| `POST` | `/api/v1/auth/refresh` | S1 | Authenticated | Rotate refresh token and issue new access token |
| `POST` | `/api/v1/auth/logout` | S1 | Authenticated | Revoke refresh token and clear session cookies |
| `POST` | `/api/v1/auth/register` | S2 | Public | Register a new Patient account (deferred per `DEC-017`) |
| `PATCH` | `/api/v1/auth/password` | S2 | Authenticated | Change authenticated user password (deferred per `DEC-017`) |
| `GET / PUT` | `/api/v1/patients/me` | S1 | Patient | Retrieve or update own patient profile |
| `GET` | `/api/v1/admin/patients` | S1 | Admin | Search and list patient accounts |
| `PATCH` | `/api/v1/admin/patients/:id/status` | S2 | Admin | Activate or deactivate patient account status |
| `GET` | `/api/v1/services` | S1 | Patient, Doctor, Admin | List active medical services (Admin sees all) |
| `POST / PUT / PATCH` | `/api/v1/admin/services` | S1 | Admin | Create, update, or activate/deactivate medical services |
| `GET` | `/api/v1/doctors` | S1 | Patient, Doctor, Admin | List active doctors (filterable by `serviceId`) |
| `POST / PUT / PATCH` | `/api/v1/admin/doctors` | S1 | Admin | Create, update, activate/deactivate doctors & assign services |
| `GET / PUT / POST / DELETE` | `/api/v1/doctors/me/schedule` & `/exceptions` | S1 | Doctor | View or update own weekly schedule & exceptions (immediate if conflict-free) |
| `GET / PUT / POST` | `/api/v1/admin/doctors/:id/schedule` & `/exceptions` | S1 | Admin | Manage or override any doctor's schedule (with audit logging) |
| `GET / PATCH` | `/api/v1/admin/settings` (`& /settings/public`) | S1 | Admin (Public read) | View or update clinic timezone, fixed start interval, and cutoff hours |
| `GET` | `/api/v1/doctors/:id/availability` | S2 | Patient, Doctor, Admin | Compute Hybrid Time Slot availability for a doctor, service, and date |
| `POST / GET / PATCH` | `/api/v1/appointments` | S2 | Patient, Doctor, Admin | Create, list, reschedule, cancel, or update appointment status |
| `GET` | `/api/v1/notifications` | S3 | Patient, Doctor, Admin | Retrieve user's in-app notifications and mark as read |
| `GET` | `/api/v1/admin/dashboard` & `/reports` | S3 | Admin | Retrieve real-time appointment metrics and custom date-range reports |

### 5.3 Standardized Response Envelopes & HTTP Status Codes

**Success Envelope (`200 OK`, `201 Created`):**

```json
{
  "success": true,
  "data": {
    "scheduleId": "550e8400-e29b-41d4-a716-446655440000",
    "dayOfWeek": 1,
    "startTime": "09:00",
    "endTime": "12:00"
  },
  "message": "Schedule updated successfully."
}
```

**Error Envelope (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`):**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_SCHEDULE_WINDOW",
    "message": "Schedule windows on the same day must not overlap."
  }
}
```

* **`401 Unauthorized`:** Missing, invalid, or expired authentication token.
* **`403 Forbidden`:** Authenticated role lacks permission for the requested action.
* **`404 Not Found`:** Resource does not exist or is masked to prevent cross-patient record enumeration (`NFR-004`).
* **`409 Conflict`:** Duplicate entity/assignment (`DUPLICATE_ASSIGNMENT`, `EMAIL_ALREADY_EXISTS`) or concurrent booking collision (`SLOT_UNAVAILABLE`).
* **`422 Unprocessable Entity`:** Business rule violation (e.g., `INVALID_SCHEDULE_WINDOW`, `CUTOFF_EXCEEDED`, `INACTIVE_DOCTOR`, `DOCTOR_NOT_ASSIGNED`).

---

## 6. Roles & Role-Based Access Control (RBAC)

### 6.1 Role Definitions & Permission Matrix

Appointly enforces three mutually exclusive primary roles in the MVP: `PATIENT`, `DOCTOR`, and `ADMIN`.

| Capability | PATIENT | DOCTOR | ADMIN |
| :--- | :---: | :---: | :---: |
| Authenticate (`/login`, `/logout`, `/me`) | Yes | Yes | Yes |
| Manage own profile | Yes | Yes | Yes |
| View active services & eligible doctors | Yes | Yes | Yes |
| Manage doctors, services & assignments | No | No | Yes |
| Manage own weekly schedule & exceptions | No | Yes (Immediate if conflict-free) | Yes |
| Manage & override all doctor schedules | No | No | Yes (With audit reason) |
| Book appointment [Sprint 2] | Yes (Self) | No | Yes (On behalf of patient) |
| View appointments & history [Sprint 2] | Own only | Assigned only | All clinic appointments |
| Reschedule / Cancel appointment [Sprint 2] | Own only (Before cutoff) | No | All (With cutoff override) |
| Update status (`COMPLETED` / `NO_SHOW`) [Sprint 2] | No | Assigned only | All |
| View clinic dashboard, reports & settings | No | Own dashboard only | Yes (Clinic-wide) |

### 6.2 Multi-Layer Enforcement Pipeline

Every protected API request passes through four sequential backend verification gates:

1. **Authentication Guard:** Verifies JWT signature and expiration from the `HttpOnly` cookie and attaches `req.user` (`{ userId, role }`).
2. **Role Guard:** Verifies `req.user.role` against the endpoint's allowed role set (`403 Forbidden` on mismatch).
3. **Resource Ownership / Assignment Guard:** Verifies that `PATIENT` queries match `patient.user_id === req.user.userId` and `DOCTOR` operations match `doctor.user_id === req.user.userId`.
4. **Domain Rule Validator:** Validates business rules (active status, service assignment, non-overlapping shifts, cutoff window) inside the service layer.

---

## 7. Security & Privacy Architecture

### 7.1 Authentication & Session Security

* **Cryptographic Password Hashing:** Passwords are hashed using **Argon2id** prior to database persistence; plaintext passwords are never logged or returned (`NFR-001`).
* **Cookie-Based JWT Security:** Access tokens (15-minute TTL) and rotating Refresh tokens (7-day TTL) are stored in `HttpOnly; Secure; SameSite=Strict` cookies (with `Secure` enabled in HTTPS environments) to mitigate XSS token theft and CSRF attacks.
* **Logout & Token Revocation:** Calling `POST /api/v1/auth/logout` clears session cookies and sets `User.refresh_token_hash = NULL` in PostgreSQL so stolen refresh cookies cannot be replayed.
* **Brute-Force Protection:** Authentication endpoints (`/auth/login`) enforce IP and account-based rate limiting.

### 7.2 Data Protection & PDPA Compliance

* **Data Minimization:** The database stores only personal data strictly necessary for account identification and scheduling (`NFR-007`).
* **Transport Encryption:** All client-server traffic in deployed environments is encrypted via HTTPS (TLS 1.2+) (`NFR-005`).
* **PII-Safe Logging:** Application error logs and `AuditLog` entries redact passwords, tokens, and unnecessary personal identifiers (`NFR-006`).
* **Anti-Enumeration:** Unauthorized cross-user resource lookups return `404 Not Found` rather than `403 Forbidden` so attackers cannot confirm the existence of another patient's UUID.

### 7.3 Auditability & Clinical Safety Boundaries

* **Immutable Audit Trail:** All administrative schedule overrides (`AuditLog`) and appointment state changes (`AppointmentHistory`) record the actor's `user_id`, action type, reason, and UTC timestamp.
* **Non-Clinical Scope Enforcement:** The system strictly prohibits EMR storage, symptom triage, diagnosis, prescriptions, or lab results, displaying emergency care guidance on booking screens.

---

## 8. Configuration & Delivery Design (Local & Planned GCP Deployment)

### 8.1 Delivery Phasing (Deliverable 1 vs. Lab 5)

* **Project Deliverable 1 (Sprint 1 Local Release):** Application runs locally with PostgreSQL 16, versioned Prisma migrations, and reproducible seed data (`server/prisma/seed.ts`). All settings are read from environment variables (`.env`), keeping real secrets out of Git.
* **Lab 5 Cloud Deployment (GCP):** The accepted Sprint 1 release is containerized with Docker and deployed to Google Cloud Platform (GCP) via GitHub Actions CI/CD pipelines (`.github/workflows/ci-docker.yml` and `deploy.yml`), documented in `docs/labs/lab-05/deployment.md`.

### 8.2 Environment Variables & Secret Management

All runtime configuration is injected via environment variables documented in `.env.example` (with placeholder values only). Real secrets are never committed to Git or embedded in client bundles.

| Variable Name | Service | Secret? | Purpose & Source |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | Backend | No | Runtime mode (`development`, `test`, `production`) |
| `PORT` | Backend | No | HTTP server listening port (default: `4000`; Cloud Run injects `8080`) |
| `DATABASE_URL` | Backend | **Yes** | PostgreSQL 16 connection string (Local `.env` / GCP Secret Manager) |
| `JWT_ACCESS_SECRET` | Backend | **Yes** | Cryptographic signing key for 15-minute access tokens (Local `.env` / GCP Secret Manager) |
| `JWT_REFRESH_SECRET` | Backend | **Yes** | Cryptographic signing key for 7-day refresh tokens (Local `.env` / GCP Secret Manager) |
| `CORS_ORIGIN` | Backend | No | Allowed frontend origin URL (e.g., `http://localhost:5173` or Cloud Run frontend URL) |
| `COOKIE_SECURE` | Backend | No | Boolean (`false` on localhost HTTP; `true` on GCP HTTPS) |
| `CLINIC_DEFAULT_TIMEZONE` | Backend | No | Default clinic timezone (`Asia/Bangkok`) |
| `SEED_ADMIN_EMAIL` | Backend | No | Synthetic seed administrator email for local/staging initialization |
| `SEED_DEFAULT_PASSWORD` | Backend | **Yes** | Synthetic seed password for local/staging test accounts (never hardcoded in source) |
| `VITE_API_BASE_URL` | Frontend | No | Base REST API URL consumed by Vite build/runtime (e.g., `/api/v1`) |

**Secret Handling Policy:**
* Local development uses `.env` files listed in `.gitignore`; only `.env.example` with dummy placeholders is committed.
* On GCP (Lab 5), sensitive values (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SEED_DEFAULT_PASSWORD`) are stored in **GCP Secret Manager** and mounted into Cloud Run revisions at runtime. GitHub Actions authenticates to GCP using **Workload Identity Federation (OIDC)** rather than long-lived JSON service account keys.

### 8.3 Planned GCP Deployment Topology (Lab 5 Reference Stack)

```text
                        [ End Users / TAs ]
                                │
                         HTTPS (Public URL)
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
   [ Cloud Run: Frontend ]        [ Cloud Run: Backend API ]
    (Nginx + React SPA)            (Node.js + Express + TS)
     min-instances: 0               min-instances: 0
                                         │
                        ┌────────────────┼────────────────┐
                        ▼                ▼                ▼
            [ Cloud SQL: PostgreSQL ] [ Secret Manager ] [ External Email ]
              (db-f1-micro, PG 16)    (DB URL & JWTs)     (Sprint 3 SMTP)
```

| Planned GCP Component | Role in Architecture | Cost & Persistence Configuration |
| :--- | :--- | :--- |
| **Cloud Run** (`appointly-api`, `appointly-web`) | Hosts containerized backend API and Nginx-served React SPA at public HTTPS URLs | `min-instances=0`, `max-instances<=3` (scales to zero when idle to conserve Free Trial credits) |
| **Cloud SQL for PostgreSQL 16** | Managed relational database providing durable storage across container restarts and redeployments | `db-f1-micro` (`--edition=enterprise`), automated daily backups, storage auto-increase disabled |
| **Artifact Registry** | Stores immutable Docker container images tagged with full Git commit SHA | Images deployed by immutable SHA digest (`deploy/release.sh`) |
| **Secret Manager** | Stores runtime secrets (`DATABASE_URL`, JWT secrets) injected securely into Cloud Run | Zero secrets in Docker images, Git history, or GitHub logs |
| **GitHub Actions + Cloud Run Job** | Runs automated build/tests on every PR (`ci-docker.yml`) and executes `prisma migrate deploy` + smoke test (`deploy.yml`) on merge to `main` | Required status check blocks merges into `main` when tests or Docker build fail |

---
*End of Appointly System-Level Software Design Specification (SDS) — Version 1.0*