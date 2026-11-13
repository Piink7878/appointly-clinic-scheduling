# Appointly — Feature Inventory and Traceability

* **Product Name:** Appointly
* **System Name:** Clinic Appointment & Scheduling Management System
* **Document Version:** 1.0 — Deliverable 1 Baseline Confirmed
* **Reference Document:** SRS & Product Scope Version 1.0 — Deliverable 1 Baseline Confirmed
* **Project Type:** Responsive Web Application
* **Development Plan:** 3 Sprints
* **Status:** Engineering Baseline Approved

---

## 1. Purpose & Traceability Structure

### 1.1 Purpose

This document translates the Appointly Software Requirements Specification (SRS & Product Scope Version 1.0) into an actionable inventory of product features and establishes complete bidirectional traceability across Requirements, Features, and Sprints.

Specifically, this document:
1. Defines the complete MVP feature inventory (`F-001` through `F-019`) across all eight system modules (`M01` through `M08`).
2. Assigns unique Feature IDs for engineering implementation, sprint planning, and QA verification.
3. Maps every Functional Requirement (`FR-001` to `FR-050`), Business Rule (`BR-001` to `BR-033`), and Non-Functional Requirement (`NFR-001` to `NFR-027`) to its implementing features and target sprint.
4. Identifies cross-feature dependencies, verifies zero coverage gaps (`Coverage Gaps = 0`), and documents approved baseline scope refinements (`DEC-001` through `DEC-017`).

### 1.2 Traceability Structure

Traceability follows a three-tier hierarchy:  
`Requirements (FR / BR / NFR) → Features (F-001 to F-019) → Sprints (Sprint 1 to Sprint 3)`

* **Requirements:** Atomic functional specifications, business rules, and quality constraints defined in SRS Version 1.0.
* **Features:** Cohesive product capabilities grouping related requirements for implementation and verification.
* **Sprints:** Phased delivery increments sequenced by technical dependencies and foundational prerequisites.

---

## 2. Feature Inventory

The Appointly MVP comprises 19 features spanning all 8 modules defined in SRS Version 1.0.

### 2.1 Feature Summary Matrix

| Feature ID | Feature Name | Module(s) | Target Sprint |
| :--- | :--- | :--- | :--- |
| **F-001** | Authentication & Role Management | M01 | Sprint 1 (Core Auth/RBAC); Sprint 2 (Self-Reg/Password) |
| **F-002** | Patient Profile Management | M02 | Sprint 1 (Profile/Directory); Sprint 2 (Account Status Toggle) |
| **F-003** | Doctor Profile Management | M03 | Sprint 1 |
| **F-004** | Medical Service Catalog | M04 | Sprint 1 |
| **F-005** | Doctor-Service Assignment | M03, M04 | Sprint 1 |
| **F-006** | Doctor Self-Schedule Management | M05 | Sprint 1 |
| **F-007** | Administrator Schedule & Clinic Configuration | M05 | Sprint 1 |
| **F-008** | Schedule Conflict Management | M05, M06 | Sprint 2 |
| **F-009** | Availability & Hybrid Time Slot Engine | M05, M06 | Sprint 2 |
| **F-010** | Patient Appointment Booking | M06 | Sprint 2 |
| **F-011** | Double Booking Prevention | M06 | Sprint 2 |
| **F-012** | Administrator-Assisted Booking | M06 | Sprint 2 |
| **F-013** | Appointment Viewing & Management | M06 | Sprint 2 |
| **F-014** | Appointment Rescheduling & Cancellation | M06 | Sprint 2 |
| **F-015** | Appointment Status & History | M06 | Sprint 2 |
| **F-016** | Appointment Notifications | M07 | Sprint 3 |
| **F-017** | Notification Delivery & Reminders | M07 | Sprint 3 |
| **F-018** | Clinic Dashboard | M08 | Sprint 3 |
| **F-019** | Appointment Reports | M08 | Sprint 3 |

### 2.2 Detailed Feature Specifications

#### Sprint 1 — System Foundation & Clinic Configuration

**F-001: Authentication & Role Management**
* **Module:** M01 — Authentication & Access Control
* **Primary Actors:** Patient, Doctor, Clinic Administrator
* **Description:** Manages secure user authentication, cryptographic password hashing, session lifecycle, current-user identity retrieval, and backend Role-Based Access Control (RBAC) across all UI routes and REST API endpoints. Per `DEC-017`, Sprint 1 uses seeded test accounts; self-service registration and password change are scheduled for Sprint 2.
* **Included Capabilities:**
  * Role-Based Login / Logout (`PATIENT`, `DOCTOR`, `ADMIN`) using Seeded Test Accounts [Sprint 1]
  * Current-User Identity Retrieval (`GET /api/v1/auth/me`) [Sprint 1]
  * Argon2id Password Hashing & HttpOnly Cookie Session Management [Sprint 1]
  * Backend 4-Gate RBAC Enforcement Across Routes & Endpoints [Sprint 1]
  * Self-Service Patient Registration & Password Change/Reset [Sprint 2 Enhancement]
* **Mapped Requirements:** `FR-001`, `FR-002`, `FR-003`, `FR-004`, `FR-005`; `BR-011`, `BR-032`; `NFR-001`, `NFR-002`, `NFR-003`, `NFR-004`, `NFR-005`, `NFR-006`, `NFR-008`, `NFR-023`, `NFR-025`

**F-002: Patient Profile Management**
* **Module:** M02 — Patient Management
* **Primary Actors:** Patient, Clinic Administrator
* **Description:** Manages essential patient demographic and contact data required for identification and appointment booking, enforcing PDPA data minimization and excluding clinical/EMR records.
* **Included Capabilities:**
  * View & Update Personal Patient Profile (`GET / PUT /api/v1/patients/me`) [Sprint 1]
  * Mandatory Field & Ownership Validation [Sprint 1]
  * Clinic Administrator Patient Account Search & Directory View (`GET /api/v1/admin/patients`) [Sprint 1]
  * Advanced Patient Account Status Activation/Deactivation [Sprint 2 Enhancement]
* **Mapped Requirements:** `FR-004`, `FR-006`, `FR-007`, `FR-008`; `BR-010`, `BR-011`; `NFR-004`, `NFR-007`, `NFR-008`; `ASM-006`, `ASM-013`

**F-003: Doctor Profile Management**
* **Module:** M03 — Doctor Management
* **Primary Actors:** Clinic Administrator, Patient
* **Description:** Manages doctor profiles, medical specialties, and active/inactive availability status so patients can browse only active doctors eligible for new bookings.
* **Included Capabilities:**
  * Create & Update Doctor Profiles
  * Manage Medical Specialty / Area of Expertise
  * Activate / Deactivate Doctor Profile Status
  * Display Active Doctor Profiles to Patients
  * Block New Bookings for Inactive Doctors
* **Mapped Requirements:** `FR-009`, `FR-010`, `FR-012`, `FR-013`; `BR-003`; `NFR-014`; `ASM-002`

**F-004: Medical Service Catalog**
* **Module:** M04 — Medical Service Management
* **Primary Actors:** Clinic Administrator, Patient
* **Description:** Manages the clinic's catalog of medical services, including service names, descriptions, fixed service durations in minutes, and active/inactive lifecycle states.
* **Included Capabilities:**
  * Create & Update Medical Services
  * Define Fixed Service Duration (in minutes)
  * Activate / Deactivate Service Status
  * Display Active Services to Patients
  * Block New Bookings for Inactive Services
* **Mapped Requirements:** `FR-014`, `FR-015`, `FR-016`, `FR-018`; `BR-004`; `NFR-014`; `ASM-002`, `ASM-003`

**F-005: Doctor-Service Assignment**
* **Module:** M03 — Doctor Management / M04 — Medical Service Management
* **Primary Actors:** Clinic Administrator, Patient
* **Description:** Manages many-to-many assignments between doctors and medical services, ensuring patients can select only active doctors assigned to their chosen service. Serves as a primary Sprint 1 domain workflow demonstrating full-stack persistence and duplicate-assignment rule rejection (`409 Conflict`).
* **Included Capabilities:**
  * Assign & Unassign Medical Services to Doctors (rejecting duplicates)
  * View Doctor-Service Mappings
  * Filter Eligible Active Doctors by Selected Medical Service
* **Mapped Requirements:** `FR-011`, `FR-017`; `BR-002`; `ASM-004`, `ASM-005`

**F-006: Doctor Self-Schedule Management**
* **Module:** M05 — Doctor Schedule Management
* **Primary Actor:** Doctor
* **Description:** Enables doctors to configure and update their own regular weekly working hours, recurring breaks, days off, holidays, and date-specific schedule exceptions, taking immediate effect when no appointment conflicts exist. Serves as the primary Sprint 1 domain journey demonstrating UI → API → PostgreSQL persistence and overlapping-shift rule rejection (`422 INVALID_SCHEDULE_WINDOW`).
* **Included Capabilities:**
  * Define & Update Regular Weekly Working Hours (rejecting overlapping or inverted shifts)
  * Define Recurring Break Periods & Ad-Hoc Unavailable Blocks
  * Define Days Off & Holidays
  * Create Date-Specific Schedule Exceptions (Overriding Weekly Hours)
  * Immediate Schedule Activation When Conflict-Free
  * View Personal Work Schedule
* **Mapped Requirements:** `FR-019`, `FR-020`, `FR-021`, `FR-022`; `BR-015`, `BR-016`, `BR-017`, `BR-020`, `BR-021`; `ASM-008`, `ASM-014`

**F-007: Administrator Schedule & Clinic Configuration**
* **Module:** M05 — Doctor Schedule Management
* **Primary Actor:** Clinic Administrator
* **Description:** Provides Clinic Administrators with clinic-wide visibility and governance over all doctor schedules as well as clinic-level scheduling parameters (timezone, fixed start interval, and cancellation cutoff defaults).
* **Included Capabilities:**
  * View & Manage Schedules for All Clinic Doctors
  * Configure Working Hours, Breaks, Holidays, and Schedule Exceptions
  * Override or Adjust Doctor Schedules for Exceptional Cases (with Audit Logging)
  * Configure Clinic Local Timezone (Default: `Asia/Bangkok`, UTC+7), Fixed Start Interval (Default: 15 minutes), and Cutoff Policy (Default: 24 hours)
* **Mapped Requirements:** `FR-047`, `FR-048`; `BR-020`, `BR-021`, `BR-023`; `NFR-015`, `NFR-027`; `ASM-007`, `ASM-012`, `ASM-014`, `ASM-015`

#### Sprint 2 — Availability & Appointment Management

**F-008: Schedule Conflict Management**
* **Module:** M05 — Doctor Schedule Management / M06 — Appointment Management
* **Primary Actors:** Doctor, Clinic Administrator
* **Description:** Validates all doctor and administrator schedule changes against existing confirmed appointments to prevent silent invalidation, blocking conflicting updates unless resolved or explicitly overridden by an administrator with an audit reason.
* **Included Capabilities:**
  * Validate Proposed Schedule Updates Against Confirmed Appointments
  * Detect & Flag Affected Confirmed Appointments
  * Block Conflicting Doctor Self-Schedule Modifications Pending Resolution
  * Execute Authorized Administrator Schedule Overrides with Mandatory Audit Reason
* **Mapped Requirements:** `FR-024`, `FR-048`; `BR-018`, `BR-019`, `BR-021`; `NFR-014`, `NFR-015`

**F-009: Availability & Hybrid Time Slot Engine**
* **Module:** M05 — Doctor Schedule Management / M06 — Appointment Management
* **Primary Actors:** Patient, Doctor, Clinic Administrator
* **Description:** Computes real-time bookable appointment start times using the Hybrid Time Slot model—generating candidate start times at the configured fixed interval (default: 15 minutes) and validating that the entire continuous service duration fits within actual doctor availability in UTC/clinic local timezone.
* **Included Capabilities:**
  * Generate Candidate Start Times at Configured Fixed Start Interval (Default: 15 minutes)
  * Evaluate Regular Working Hours & Date-Specific Schedule Exceptions
  * Exclude Breaks, Days Off, Holidays, Unavailable Blocks, and Past Timestamps
  * Exclude Existing Confirmed Appointments
  * Validate Continuous Uninterrupted Availability for Full Service Duration
  * Store Timestamps in UTC & Convert Consistently to Clinic Timezone (Default: `Asia/Bangkok`, UTC+7)
* **Mapped Requirements:** `FR-023`, `FR-026`, `FR-050`; `BR-001`, `BR-005`, `BR-006`, `BR-007`, `BR-013`, `BR-014`, `BR-017`; `NFR-009`, `NFR-010`, `NFR-021`, `NFR-025`, `NFR-027`; `ASM-011`, `ASM-012`, `ASM-015`

**F-010: Patient Appointment Booking**
* **Module:** M06 — Appointment Management
* **Primary Actor:** Patient
* **Description:** Provides a guided self-service booking flow allowing patients to select a service, eligible doctor, date, and available time slot, review details, and receive Instant Confirmation upon atomic persistence.
* **Included Capabilities:**
  * Step-by-Step Selection (Active Service → Assigned Active Doctor → Date → Available Slot)
  * Pre-Submission Appointment Summary Review
  * Backend Availability Revalidation Prior to Persistence
  * Automatic Confirmed Status Assignment (Instant Confirmation — No Manual Approval Queue)
  * Service Name & Duration Snapshot Persistence
  * Clear Booking Confirmation & Conflict UI Feedback
* **Mapped Requirements:** `FR-025`, `FR-027`, `FR-028`, `FR-029`; `BR-001`, `BR-002`, `BR-003`, `BR-004`, `BR-009`, `BR-010`, `BR-028`, `BR-029`; `NFR-014`, `NFR-019`, `NFR-020`, `NFR-021`, `NFR-025`

**F-011: Double Booking Prevention**
* **Module:** M06 — Appointment Management
* **Primary Actors:** Patient, Clinic Administrator
* **Description:** Enforces atomic PostgreSQL database transactions, GiST exclusion constraints, and request idempotency across all booking channels to prevent overlapping confirmed appointments or duplicate submissions.
* **Included Capabilities:**
  * Atomic PostgreSQL Transaction Execution for Create & Reschedule
  * Database-Level GiST Exclusion Constraint Against Overlapping Intervals
  * Submission Idempotency to Prevent Duplicate Bookings on Network Retries
  * Explicit Conflict Error Responses When Slots Are Claimed Concurrently
* **Mapped Requirements:** `FR-029`, `FR-030`; `BR-008`, `BR-009`; `NFR-011`, `NFR-012`, `NFR-018`; `ASM-017`

**F-012: Administrator-Assisted Booking**
* **Module:** M06 — Appointment Management
* **Primary Actor:** Clinic Administrator
* **Description:** Enables Clinic Administrators to create appointments on behalf of registered patients (e.g., phone or walk-in requests), linking the target patient account, recording the creating administrator's ID, and enforcing identical validation rules.
* **Included Capabilities:**
  * Search & Select Existing Registered Patient Account
  * Select Active Service, Eligible Doctor, Date, and Available Time Slot
  * Enforce Identical Availability & Double-Booking Validation Rules
  * Link Appointment to Patient Account & Log Creating Administrator ID
  * Assign Instant Confirmed Status
* **Mapped Requirements:** `FR-037`, `FR-049`; `BR-001` to `BR-009`, `BR-012`, `BR-013`, `BR-014`, `BR-028`; `NFR-003`, `NFR-011`, `NFR-012`; `ASM-016`, `ASM-017`

**F-013: Appointment Viewing & Management**
* **Module:** M06 — Appointment Management
* **Primary Actors:** Patient, Doctor, Clinic Administrator
* **Description:** Provides role-scoped appointment lists, detail views, and filtering so patients see their own appointments, doctors see assigned schedules, and administrators manage all clinic appointments.
* **Included Capabilities:**
  * Patient View Own Upcoming & Historical Appointments
  * Doctor View Personal Dashboard & Assigned Appointment Schedules
  * Clinic Administrator View, Search & Filter All Clinic Appointments
  * Role-Scoped Appointment Detail Inspection
* **Mapped Requirements:** `FR-031`, `FR-035`, `FR-046`; `BR-011`; `NFR-003`, `NFR-004`, `NFR-009`, `NFR-019`, `NFR-022`

**F-014: Appointment Rescheduling & Cancellation**
* **Module:** M06 — Appointment Management
* **Primary Actors:** Patient, Clinic Administrator
* **Description:** Enables patients to reschedule or cancel their own confirmed appointments prior to the clinic's configurable cutoff deadline (default: 24 hours), while allowing administrators to override cutoff restrictions with a recorded reason.
* **Included Capabilities:**
  * Reschedule Confirmed Appointment with Full Slot Revalidation
  * Atomic Rollback Preserving Original Appointment if New Slot Fails
  * Cancel Confirmed Appointment
  * Enforce Configurable Cutoff Policy (Default: 24 Hours Prior to Start Time)
  * Administrator Cutoff Override with Mandatory Audit Reason
* **Mapped Requirements:** `FR-032`, `FR-033`; `BR-022`, `BR-023`, `BR-024`, `BR-025`, `BR-026`, `BR-027`; `NFR-003`, `NFR-013`, `NFR-015`, `NFR-020`, `NFR-025`

**F-015: Appointment Status & History**
* **Module:** M06 — Appointment Management
* **Primary Actors:** Doctor, Clinic Administrator, Patient
* **Description:** Governs appointment lifecycle state transitions (`Confirmed`, `Completed`, `Cancelled`, `No-show`) and records an immutable audit history of every booking, reschedule, cancellation, and status update with responsible user ID and UTC timestamp.
* **Included Capabilities:**
  * Enforce Valid MVP State Transitions & Terminal Statuses (`Completed`, `Cancelled`, `No-show`)
  * Authorized Status Updates to `Completed` or `No-show` (Assigned Doctor / Admin)
  * Retain `Confirmed` Status Upon Rescheduling
  * Immutable Audit Log of All State & Time Changes (Actor ID + UTC Timestamp)
  * Preserve Historical Service Name & Duration Snapshots
* **Mapped Requirements:** `FR-034`, `FR-036`; `BR-026`, `BR-027`, `BR-028`, `BR-030`, `BR-031`, `BR-032`, `BR-033`; `NFR-003`, `NFR-006`, `NFR-014`, `NFR-015`

#### Sprint 3 — Notifications & Clinic Insights

**F-016: Appointment Notifications**
* **Module:** M07 — Notification Management
* **Primary Actors:** Patient, Clinic Administrator
* **Description:** Generates and dispatches both in-app and email notifications upon appointment confirmation, rescheduling, and cancellation, isolated from core booking transactions so delivery failures never roll back confirmed appointments.
* **Included Capabilities:**
  * Booking Confirmation Notification (In-App & Email)
  * Rescheduling Notification (In-App & Email)
  * Cancellation Notification (In-App & Email)
  * Transaction Isolation Ensuring Email Failures Do Not Roll Back Bookings
* **Mapped Requirements:** `FR-038`, `FR-039`; `NFR-016`, `NFR-020`, `NFR-027`; `ASM-010`

**F-017: Notification Delivery & Reminders**
* **Module:** M07 — Notification Management
* **Primary Actors:** Patient, System (System Clock UTC / Email Service)
* **Description:** Schedules pre-appointment in-app and email reminders, tracks notification delivery statuses (`Pending`, `Sent`, `Failed`), and retries failed deliveries asynchronously without duplicating appointments.
* **Included Capabilities:**
  * Automated Pre-Appointment Reminder Scheduling (In-App & Email)
  * Delivery Status Tracking (`Pending`, `Sent`, `Failed`)
  * Asynchronous Retry Mechanism for Failed Email Deliveries
  * Idempotent Notification Processing Preventing Duplicate Appointments
* **Mapped Requirements:** `FR-040`, `FR-041`; `NFR-016`, `NFR-017`, `NFR-018`, `NFR-027`; `ASM-010`

**F-018: Clinic Dashboard**
* **Module:** M08 — Clinic Dashboard & Reports
* **Primary Actor:** Clinic Administrator
* **Description:** Provides Clinic Administrators with an operational dashboard displaying real-time appointment metrics, status breakdowns (`Confirmed`, `Completed`, `Cancelled`, `No-show`), and upcoming appointments.
* **Included Capabilities:**
  * Total Appointments Overview
  * Appointment Counts Grouped by Status (`Confirmed`, `Completed`, `Cancelled`, `No-show`)
  * Upcoming Clinic Appointments Operational Feed
* **Mapped Requirements:** `FR-042`, `FR-043`, `FR-044`; `NFR-019`, `NFR-022`

**F-019: Appointment Reports**
* **Module:** M08 — Clinic Dashboard & Reports
* **Primary Actor:** Clinic Administrator
* **Description:** Generates summary appointment reports filtered by custom date ranges and grouped by status to support clinic operational analysis.
* **Included Capabilities:**
  * Custom Date-Range Filter
  * Appointment Volume & Status Summary Generation
  * Operational Appointment Statistics View
* **Mapped Requirements:** `FR-045`; `NFR-009`, `NFR-019`, `NFR-022`

---

## 3. Sprint Allocation & Cross-Feature Dependencies

### 3.1 Sprint Allocation Overview

| Sprint | Sprint Name | Primary Scope | Allocated Features |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | System Foundation & Clinic Configuration | Core Login/Logout/RBAC (seeded accounts), patient profile/directory, doctor & service catalogs, doctor-service assignments, doctor self-schedules (primary domain journey), and admin schedule/clinic configuration | `F-001` to `F-007` |
| **Sprint 2** | Availability & Appointment Management | Self-registration & password recovery, schedule conflict validation, 15-min Hybrid Time Slot engine, self-service & admin booking, PostgreSQL GiST double-booking prevention, rescheduling/cancellation (24h cutoff), and status/history tracking | `F-001` (ext.), `F-002` (ext.), `F-008` to `F-015` |
| **Sprint 3** | Notifications & Clinic Insights | In-app & email booking/change notifications, scheduled reminders, delivery retry tracking, clinic dashboard, and date-range reports | `F-016` to `F-019` |

### 3.2 Cross-Feature Dependencies

| Feature ID | Depends On | Technical Dependency Rationale |
| :--- | :--- | :--- |
| **F-002** | F-001 | Requires authenticated user accounts and RBAC ownership enforcement before managing patient profiles |
| **F-003** | F-001 | Requires Clinic Administrator authentication and RBAC authorization to manage doctor records |
| **F-004** | F-001 | Requires Clinic Administrator authentication and RBAC authorization to manage medical services |
| **F-005** | F-003, F-004 | Requires active doctor and medical service entities before creating many-to-many assignments |
| **F-006** | F-001 | Requires Doctor role authentication before configuring personal schedules |
| **F-007** | F-001, F-003 | Requires Clinic Administrator privileges and doctor records to manage clinic-wide schedules and defaults |
| **F-008** | F-006, F-007, F-015 | Requires doctor schedule definitions and confirmed appointment state records to detect conflicts |
| **F-009** | F-003, F-004, F-005, F-006, F-007 | Requires active doctors, service durations, doctor-service assignments, schedules, and configured interval/timezone |
| **F-010** | F-001, F-002, F-004, F-005, F-009 | Requires patient account, active service, assigned doctor, and real-time slot computation prior to booking |
| **F-011** | F-009, F-010 | Requires availability calculation and booking persistence pipeline to enforce PostgreSQL transactional locking |
| **F-012** | F-001, F-002, F-004, F-005, F-009, F-011 | Requires existing patient lookup and shares the exact availability and double-booking validation pipeline |
| **F-013** | F-001, F-002, F-003, F-010 | Requires role-based authentication and persisted appointments to display role-scoped views |
| **F-014** | F-009, F-010, F-013 | Requires existing confirmed appointments, cutoff policy validation, and slot revalidation for rescheduling |
| **F-015** | F-010, F-012 | Requires appointment creation transactions before tracking status transitions and immutable audit history |
| **F-016** | F-010, F-012, F-014 | Triggered asynchronously by booking confirmation, rescheduling, and cancellation events |
| **F-017** | F-016 | Builds upon notification dispatch infrastructure to schedule reminders and execute asynchronous retries |
| **F-018** | F-013, F-015 | Aggregates persisted appointment records and lifecycle statuses for operational metrics |
| **F-019** | F-013, F-015 | Queries historical appointment records and status distributions across custom date ranges |

---

## 4. Requirements Traceability Matrices

### 4.1 Functional Requirements Traceability Matrix (FR-001 to FR-050)

| Requirement ID | Module | Implementing Feature(s) | Target Sprint & Verification |
| :--- | :--- | :--- | :--- |
| **FR-001** | M01 | F-001 | Sprint 2 (Deferred per `DEC-017`) |
| **FR-002** | M01 | F-001 | Sprint 1 (`AC-F001-01` / `STS-S1-001`) |
| **FR-003** | M01 | F-001 | Sprint 1 (`AC-F001-03` / `STS-S1-003`) |
| **FR-004** | M01 | F-001, F-002 | Sprint 1 (`AC-F002-01` / `STS-S1-004`) |
| **FR-005** | M01 | F-001 | Sprint 2 (Deferred per `DEC-017`) |
| **FR-006** | M02 | F-002 | Sprint 1 (`AC-F002-01` / `STS-S1-004`) |
| **FR-007** | M02 | F-002 | Sprint 1 (`AC-F002-01` / `STS-S1-004`) |
| **FR-008** | M02 | F-002 | Sprint 1 (Directory) & Sprint 2 (Status Toggle) |
| **FR-009** | M03 | F-003 | Sprint 1 (`AC-F003-01` / `STS-S1-005`) |
| **FR-010** | M03 | F-003 | Sprint 1 (`AC-F003-01` / `STS-S1-005`) |
| **FR-011** | M03 | F-005 | Sprint 1 (`AC-F005-01` / `STS-S1-007`) |
| **FR-012** | M03 | F-003 | Sprint 1 (`AC-F003-01` / `STS-S1-005`) |
| **FR-013** | M03 | F-003 | Sprint 1 (`AC-F003-02` / `STS-S1-005`) |
| **FR-014** | M04 | F-004 | Sprint 1 (`AC-F004-01` / `STS-S1-006`) |
| **FR-015** | M04 | F-004 | Sprint 1 (`AC-F004-01` / `STS-S1-006`) |
| **FR-016** | M04 | F-004 | Sprint 1 (`AC-F004-01` / `STS-S1-006`) |
| **FR-017** | M04 | F-005 | Sprint 1 (`AC-F005-01` / `STS-S1-007`) |
| **FR-018** | M04 | F-004 | Sprint 1 (`AC-F004-02` / `STS-S1-006`) |
| **FR-019** | M05 | F-006 | Sprint 1 (`AC-F006-01` / `STS-S1-008`) |
| **FR-020** | M05 | F-006 | Sprint 1 (`AC-F006-01` / `STS-S1-008`) |
| **FR-021** | M05 | F-006 | Sprint 1 (`AC-F006-03` / `STS-S1-008`) |
| **FR-022** | M05 | F-006 | Sprint 1 (`AC-F006-03` / `STS-S1-008`) |
| **FR-023** | M05 | F-009 | Sprint 2 |
| **FR-024** | M05 | F-008 | Sprint 2 (Conflict against Confirmed Appointments) |
| **FR-025** | M06 | F-010 | Sprint 2 |
| **FR-026** | M06 | F-009 | Sprint 2 |
| **FR-027** | M06 | F-010 | Sprint 2 |
| **FR-028** | M06 | F-010 | Sprint 2 |
| **FR-029** | M06 | F-010, F-011 | Sprint 2 |
| **FR-030** | M06 | F-011 | Sprint 2 |
| **FR-031** | M06 | F-013 | Sprint 2 |
| **FR-032** | M06 | F-014 | Sprint 2 |
| **FR-033** | M06 | F-014 | Sprint 2 |
| **FR-034** | M06 | F-015 | Sprint 2 |
| **FR-035** | M06 | F-013 | Sprint 2 |
| **FR-036** | M06 | F-015 | Sprint 2 |
| **FR-037** | M06 | F-012 | Sprint 2 |
| **FR-038** | M07 | F-016 | Sprint 3 |
| **FR-039** | M07 | F-016 | Sprint 3 |
| **FR-040** | M07 | F-017 | Sprint 3 |
| **FR-041** | M07 | F-017 | Sprint 3 |
| **FR-042** | M08 | F-018 | Sprint 3 |
| **FR-043** | M08 | F-018 | Sprint 3 |
| **FR-044** | M08 | F-018 | Sprint 3 |
| **FR-045** | M08 | F-019 | Sprint 3 |
| **FR-046** | M08 | F-013 | Sprint 2 |
| **FR-047** | M05 | F-007 | Sprint 1 (`AC-F007-01` / `STS-S1-009`) |
| **FR-048** | M05 | F-007, F-008 | Sprint 1 (`AC-F007-01`) & Sprint 2 |
| **FR-049** | M06 | F-012 | Sprint 2 |
| **FR-050** | M06 | F-009 | Sprint 2 |

### 4.2 Business Rules Traceability Matrix (BR-001 to BR-033)

| Business Rule ID | Rule Category | Enforcing Feature(s) | Target Sprint & Verification |
| :--- | :--- | :--- | :--- |
| **BR-001** | Booking Rules | F-009, F-010, F-012 | Sprint 2 |
| **BR-002** | Booking Rules | F-005, F-010, F-012 | Sprint 1 (`AC-F005-01`) & Sprint 2 |
| **BR-003** | Booking Rules | F-003, F-010, F-012 | Sprint 1 (`AC-F003-02`) & Sprint 2 |
| **BR-004** | Booking Rules | F-004, F-010, F-012 | Sprint 1 (`AC-F004-02`) & Sprint 2 |
| **BR-005** | Booking Rules | F-009, F-012 | Sprint 2 |
| **BR-006** | Booking Rules | F-009, F-012 | Sprint 2 |
| **BR-007** | Booking Rules | F-009, F-012 | Sprint 2 |
| **BR-008** | Booking Rules | F-011, F-012 | Sprint 2 |
| **BR-009** | Booking Rules | F-010, F-011, F-012 | Sprint 2 |
| **BR-010** | Booking Rules | F-002, F-010 | Sprint 1 (`AC-F002-03`) & Sprint 2 |
| **BR-011** | Booking Rules | F-001, F-002, F-013 | Sprint 1 (`AC-F002-02`) & Sprint 2 |
| **BR-012** | Booking Rules | F-012 | Sprint 2 |
| **BR-013** | Booking Rules | F-009, F-012 | Sprint 2 |
| **BR-014** | Booking Rules | F-009, F-012 | Sprint 2 |
| **BR-015** | Schedule Rules | F-006, F-007 | Sprint 1 (`AC-F006-01`, `AC-F006-02`) |
| **BR-016** | Schedule Rules | F-006, F-007 | Sprint 1 (`AC-F006-01`) |
| **BR-017** | Schedule Rules | F-006, F-007, F-009 | Sprint 1 (`AC-F006-03`) & Sprint 2 |
| **BR-018** | Schedule Rules | F-008 | Sprint 2 |
| **BR-019** | Schedule Rules | F-008 | Sprint 2 |
| **BR-020** | Schedule Rules | F-006, F-007 | Sprint 1 (`AC-F006-01`, `AC-F007-01`) |
| **BR-021** | Schedule Rules | F-006, F-007, F-008 | Sprint 1 (`AC-F006-02`) & Sprint 2 |
| **BR-022** | Cancellation & Rescheduling | F-014 | Sprint 2 |
| **BR-023** | Cancellation & Rescheduling | F-007, F-014 | Sprint 1 (`AC-F007-01`) & Sprint 2 |
| **BR-024** | Cancellation & Rescheduling | F-009, F-014 | Sprint 2 |
| **BR-025** | Cancellation & Rescheduling | F-014 | Sprint 2 |
| **BR-026** | Cancellation & Rescheduling | F-014, F-015 | Sprint 2 |
| **BR-027** | Cancellation & Rescheduling | F-014, F-015 | Sprint 2 |
| **BR-028** | Confirmation & Status Rules | F-010, F-012, F-015 | Sprint 2 |
| **BR-029** | Confirmation & Status Rules | F-010 | Sprint 2 |
| **BR-030** | Confirmation & Status Rules | F-015 | Sprint 2 |
| **BR-031** | Confirmation & Status Rules | F-014, F-015 | Sprint 2 |
| **BR-032** | Confirmation & Status Rules | F-001, F-015 | Sprint 1 (`AC-F001-03`) & Sprint 2 |
| **BR-033** | Confirmation & Status Rules | F-015 | Sprint 2 |

### 4.3 Non-Functional Requirements Traceability Matrix (NFR-001 to NFR-027)

| NFR ID | Quality Category | Constrained Feature(s) | Target Sprint |
| :--- | :--- | :--- | :--- |
| **NFR-001** | Security & Privacy | F-001 | Sprint 1 |
| **NFR-002** | Security & Privacy | F-001 (All Protected Routes & APIs) | Sprint 1–3 |
| **NFR-003** | Security & Privacy | F-001, F-002, F-010, F-012, F-013, F-014, F-015 | Sprint 1 & 2 |
| **NFR-004** | Security & Privacy | F-001, F-002, F-013 | Sprint 1 & 2 |
| **NFR-005** | Security & Privacy | F-001 (All Network Transmissions) | Lab 5 / Sprint 3 |
| **NFR-006** | Security & Privacy | F-001, F-015 (System-Wide Logging) | Sprint 1–3 |
| **NFR-007** | Security & Privacy | F-002 | Sprint 1 |
| **NFR-008** | Security & Privacy | F-001, F-002 | Sprint 1 |
| **NFR-009** | Performance | F-009, F-013, F-019 (All Standard APIs) | Sprint 2 & 3 |
| **NFR-010** | Performance | F-009 | Sprint 2 |
| **NFR-011** | Performance | F-011, F-012 | Sprint 2 |
| **NFR-012** | Reliability & Data Integrity | F-011, F-012 | Sprint 2 |
| **NFR-013** | Reliability & Data Integrity | F-014 | Sprint 2 |
| **NFR-014** | Reliability & Data Integrity | F-003, F-004, F-008, F-010, F-015 | Sprint 1 & 2 |
| **NFR-015** | Reliability & Data Integrity | F-007, F-008, F-014, F-015 | Sprint 1 & 2 |
| **NFR-016** | Reliability & Data Integrity | F-016, F-017 | Sprint 3 |
| **NFR-017** | Reliability & Data Integrity | F-017 | Sprint 3 |
| **NFR-018** | Reliability & Data Integrity | F-011, F-017 | Sprint 2 & 3 |
| **NFR-019** | Usability & Accessibility | F-006, F-010, F-013, F-018, F-019 | Sprint 1–3 |
| **NFR-020** | Usability & Accessibility | F-005, F-006, F-010, F-011, F-014, F-016 | Sprint 1–3 |
| **NFR-021** | Usability & Accessibility | F-009, F-010, F-011 | Sprint 2 |
| **NFR-022** | Usability & Accessibility | All User-Facing Features (F-001 to F-019) | Sprint 1–3 |
| **NFR-023** | Usability & Accessibility | F-001 (All Role Interfaces) | Sprint 1–3 |
| **NFR-024** | Maintainability & Compatibility | System-Wide Architecture (F-001 to F-019) | Sprint 1–3 |
| **NFR-025** | Maintainability & Compatibility | F-001, F-006, F-009, F-010, F-014 (All Backend APIs) | Sprint 1–3 |
| **NFR-026** | Maintainability & Compatibility | All User-Facing Features (F-001 to F-019) | Sprint 1–3 |
| **NFR-027** | Maintainability & Compatibility | F-006, F-007, F-009, F-010, F-014, F-016, F-017 | Sprint 1–3 |

---

## 5. Traceability Coverage Verification, Gaps & Approved Changes

### 5.1 Requirement & Module Coverage Summary

| Artifact Category | Identifier Range | Total Count | Mapped Count | Uncovered Count | Verification Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **MVP Modules** | M01 to M08 | 8 | 8 | 0 | 100% Covered |
| **Functional Requirements** | FR-001 to FR-050 | 50 | 50 | 0 | 100% Mapped |
| **Business Rules** | BR-001 to BR-033 | 33 | 33 | 0 | 100% Mapped |
| **Non-Functional Requirements** | NFR-001 to NFR-027 | 27 | 27 | 0 | 100% Mapped |
| **Confirmed Decisions** | DEC-001 to DEC-017 | 17 | 17 | 0 | 100% Incorporated |
| **System Assumptions** | ASM-001 to ASM-017 | 17 | 17 | 0 | 100% Aligned |

### 5.2 Coverage Gaps Statement
* **Uncovered Requirements (Coverage Gaps = 0):** Zero orphan requirements exist in the baseline. Every Functional Requirement (`FR-001`–`FR-050`), Business Rule (`BR-001`–`BR-033`), and Non-Functional Requirement (`NFR-001`–`NFR-027`) is explicitly mapped to at least one implementing Feature (`F-001`–`F-019`) and a designated verification Sprint.

### 5.3 Approved Baseline Changes
| Change ID | Version | Affected Artifacts | Approved Change Description & Rationale |
| :--- | :--- | :--- | :--- |
| **CHG-001** | v1.0 | `F-001`, `F-002`, `FR-001`, `FR-005`, `FR-008`, `DEC-017` | Scoped Sprint 1 authentication to reproducible seeded test accounts (`Login`, `Logout`, `GET /auth/me`, and 4-gate `RBAC`), deferring patient self-registration (`FR-001`), password change/recovery (`FR-005`), and advanced patient account suspension (`FR-008` status toggle) to Sprint 2 in accordance with Project Deliverable 1 baseline guidelines. |
| **CHG-002** | v1.0 | `F-005`, `F-006`, `NFR-001`–`NFR-027` | Designated `F-006` (Doctor Self-Schedule Management) and `F-005` (Doctor-Service Assignment) as the primary Sprint 1 vertical-slice domain journeys demonstrating end-to-end persistence and business-rule rejection (`422` overlapping schedule windows; `409` duplicate assignments), and added explicit verification methods to all NFRs. |

*End of Appointly Feature Inventory and Traceability — Version 1.0*