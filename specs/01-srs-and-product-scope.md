# Appointly — Software Requirements Specification (SRS) & Product Scope

* **Product Name:** Appointly
* **System Name:** Clinic Appointment & Scheduling Management System
* **Document Version:** 1.0 — Deliverable 1 Baseline Confirmed
* **Project Type:** Responsive Web Application
* **System Scope:** Single Clinic / Single Organization
* **Status:** Engineering Baseline Approved

---

## 1. Product Overview

### 1.1 Product Description
Appointly is a web-based appointment and scheduling management system designed for small-to-medium private clinics. It enables patients to browse active medical services, select eligible doctors, inspect real-time slot availability, and book, reschedule, or cancel appointments online.

Doctors can configure and manage their own work schedules and update the status of assigned appointments, while Clinic Administrators govern clinic-wide configurations, doctor profiles, service catalogs, schedules, and all clinic appointments.

The system strictly addresses Appointment and Scheduling Management; it does not function as an Electronic Medical Record (EMR) system or a Hospital Information System (HIS).

### 1.2 Product Vision
To make clinic appointments simple, accessible, and well-organized for both patients and healthcare providers.

### 1.3 Problems to Solve
1. Patients must call or visit the clinic in person to inquire about doctor availability.
2. Clinic staff must manually consolidate appointment requests across fragmented channels.
3. Varying work schedules across doctors complicate manual appointment allocation.
4. Rescheduling or cancellation actions frequently result in desynchronized schedule records.
5. Manual scheduling introduces a high risk of overlapping bookings (Double Booking).
6. Clinics lack real-time visibility into appointment volume and status distribution.

### 1.4 Target Organization
Small-to-medium private outpatient clinics (such as General Clinics, Dental Clinics, Dermatology Clinics, and Physical Therapy Clinics) characterized by:
* Multiple doctors or healthcare providers
* Multiple distinct medical service offerings
* Individualized working hours per doctor
* Advance online patient appointment scheduling
* Dedicated administrative staff managing clinic configurations and operations

---

## 2. Actors & Access Permissions

### 2.1 Primary Actors

**ACT-01: Patient**
An end-user who interacts with the system to discover clinic services and manage their own appointments.

*Responsibilities:*
* Authenticate into the system (and register an account in post-Sprint 1 self-service expansion)
* View and update personal profile and contact information
* Browse active medical services and eligible doctor profiles
* Select a service, doctor, appointment date, and available time slot
* Create and confirm appointments
* Inspect upcoming and historical personal appointments
* Reschedule or cancel personal appointments within clinic cutoff policies
* Receive in-app and email notifications regarding appointment events

**ACT-02: Doctor**
A healthcare provider assigned to deliver medical services and manage personal clinical availability.

*Responsibilities:*
* Authenticate into the system
* View personal assigned appointment schedules
* View appointment details and essential patient contact information required for service delivery
* Define and update personal regular weekly working hours, breaks, days off, and schedule exceptions (taking immediate effect when conflict-free)
* Update the status of assigned appointments to Completed or No-show

**ACT-03: Clinic Administrator**
An authorized staff member or system administrator responsible for clinic-level configuration and operational governance.

*Responsibilities:*
* Authenticate with administrative privileges
* Manage patient and doctor accounts
* Create, update, and deactivate doctor profiles and specialties
* Create, update, and deactivate medical services and service durations
* Manage doctor-to-service assignments
* View, create, update, and override schedules across all doctors in the clinic
* Create appointments on behalf of existing patients
* View, reschedule, cancel, and manage all clinic appointments, including policy overrides with recorded reasons
* Configure system parameters (e.g., fixed start interval, cancellation cutoff period)
* Monitor clinic-wide appointment dashboards and generate date-range reports

### 2.2 External Supporting Systems

| ID | External System | Responsibility |
| :--- | :--- | :--- |
| **ACT-04** | Email Notification Service | Delivers transactional emails for booking confirmations, reschedules, cancellations, and scheduled reminders |
| **ACT-05** | System Clock (UTC) | Provides authoritative UTC timestamps for availability calculation, cutoff enforcement, and reminder scheduling |

*Note: ACT-04 and ACT-05 are non-human external supporting systems and do not authenticate as interactive users.*

### 2.3 Actor Permission Matrix

| Capability | Patient | Doctor | Clinic Administrator |
| :--- | :---: | :---: | :---: |
| Manage own profile | Yes | Yes | Yes |
| View active services & doctors | Yes | Yes | Yes |
| Book appointment | Yes (Self) | No | Yes (On behalf of patient) |
| View appointments | Own only | Assigned only | All clinic appointments |
| Reschedule appointment | Own only (within policy) | No | Yes (All, with override) |
| Cancel appointment | Own only (within policy) | No | Yes (All, with override) |
| Manage own schedule | No | Yes (Immediate if conflict-free) | Yes |
| Manage other doctors' schedules | No | No | Yes (With conflict validation / override) |
| Manage doctors & services | No | No | Yes |
| Update appointment status | No | Yes (Assigned only) | Yes (All) |
| View clinic dashboard & reports | No | Own schedule only | Yes (Clinic-wide) |

> **Permission Principle:** Doctors manage their own schedules autonomously, whereas Clinic Administrators hold clinic-wide governance over all doctor schedules, configurations, and appointment operations.

---

## 3. Product Scope & Exclusions

### 3.1 In Scope (MVP — 8 Core Modules)

| Module ID | Module Name | Included Capabilities |
| :--- | :--- | :--- |
| **M01** | Authentication & Access Control | Login/logout, current-user identity retrieval, Role-Based Access Control (RBAC), and post-Sprint 1 patient registration & password management |
| **M02** | Patient Management | Patient profile viewing/editing, contact details, and administrator patient directory/account management |
| **M03** | Doctor Management | Doctor profile lifecycle (create/update/deactivate), specialties, availability status, and service assignments |
| **M04** | Medical Service Management | Service catalog (name, description, duration), doctor assignments, and active/inactive lifecycle |
| **M05** | Doctor Schedule Management | Regular weekly hours, breaks, holidays/days off, schedule exceptions, self-service management, and admin oversight |
| **M06** | Appointment Management | Hybrid time slot selection, actual availability validation, instant confirmation, rescheduling, cancellation, status tracking, history, and admin-assisted booking |
| **M07** | Notification Management | In-app and email notifications for booking confirmation, rescheduling, cancellation, and scheduled reminders with retry tracking |
| **M08** | Clinic Dashboard & Reports | Clinic-wide appointment overview, status summaries, upcoming appointment lists, and date-range statistical reports |

### 3.2 Out of Scope / Exclusions

| ID | Excluded Feature | Engineering Rationale |
| :--- | :--- | :--- |
| **EX-01** | Electronic Medical Records (EMR) | Outside the functional boundary of appointment scheduling |
| **EX-02** | Diagnosis & Treatment Records | Clinical documentation is excluded to protect privacy and avoid medical liability |
| **EX-03** | Prescription Management | Requires clinical workflows and regulatory controls outside MVP scope |
| **EX-04** | Laboratory Results | Unrelated to appointment slot and schedule management |
| **EX-05** | Online Payment Processing | Avoids payment gateway integration and financial transaction complexity in MVP |
| **EX-06** | Insurance Claims & Billing | Requires payer integrations and billing workflows outside MVP scope |
| **EX-07** | Telemedicine / Video Consultation | Requires real-time media streaming infrastructure outside MVP scope |
| **EX-08** | AI Medical Assistant / Triage | System must not perform clinical assessment or medical diagnosis |
| **EX-09** | Multi-Branch / Multi-Tenant Support | MVP architecture is scoped strictly to a single clinic organization |
| **EX-10** | Pharmacy & Inventory Management | Belongs to a separate supply-chain/inventory domain |
| **EX-11** | Patient Reviews & Ratings | Non-essential to core scheduling operations |
| **EX-12** | External Calendar Synchronization | Avoids third-party OAuth/calendar sync complexity in MVP |
| **EX-13** | Waiting List Management | Deferred to post-MVP enhancements |
| **EX-14** | Dynamic Pricing | Financial pricing models are excluded from MVP |

### 3.3 Scope Boundaries
1. The system stores only demographic, contact, and scheduling metadata necessary for appointments; clinical or medical records are strictly prohibited.
2. Patients are restricted to viewing and managing their own profile and appointments.
3. Doctors are restricted to viewing assigned appointments and managing their own work schedules.
4. Clinic Administrators have full operational control over clinic configurations, schedules, and appointments.
5. Administrator-assisted bookings must be linked to a registered patient account and audit-logged with the creating administrator's ID.
6. Every appointment must reference an active medical service, an active doctor assigned to that service, and a valid available time window.
7. Slot availability is calculated using a Hybrid Time Slot model (15-minute default configurable fixed start interval validated against full service duration and actual doctor availability).
8. Valid bookings transition immediately to Confirmed status upon atomic database persistence (Instant Confirmation).
9. Concurrent or overlapping bookings for the same doctor must be prevented at the database transaction level.
10. Doctor schedule modifications take immediate effect if no conflicts exist; any change conflicting with existing confirmed appointments is blocked unless resolved or explicitly overridden by an administrator with a recorded reason.

---

## 4. Functional Requirements (FR)

**Priority Definitions:**
* **Must:** Mandatory for MVP release.
* **Should:** High-value requirement included in MVP baseline unless constrained.
* **Could:** Desirable enhancement if capacity permits.
* **Won't:** Explicitly excluded from current release.

### 4.1 Authentication & Access Control (M01)

| ID | Functional Requirement | Priority |
| :--- | :--- | :---: |
| **FR-001** | The system shall allow patients to register an account by providing required personal and contact information (deferred to Sprint 2; Sprint 1 uses seeded accounts). | Should |
| **FR-002** | The system shall allow registered users (Patient, Doctor, Clinic Administrator) to authenticate (log in), retrieve current-user identity, and terminate sessions (log out). | Must |
| **FR-003** | The system shall identify each authenticated user's role and enforce Role-Based Access Control (RBAC) across all UI routes and API endpoints. | Must |
| **FR-004** | The system shall allow authenticated users to view and update their own basic profile details. | Must |
| **FR-005** | The system shall allow users to securely change or reset their passwords (deferred to Sprint 2). | Should |

### 4.2 Patient Management (M02)

| ID | Functional Requirement | Priority |
| :--- | :--- | :---: |
| **FR-006** | The system shall allow patients to view their own profile information. | Must |
| **FR-007** | The system shall allow patients to update their personal and contact information. | Must |
| **FR-008** | The system shall allow Clinic Administrators to view, search, and manage patient accounts (advanced account status toggle deferred to Sprint 2). | Must |

### 4.3 Doctor Management (M03)

| ID | Functional Requirement | Priority |
| :--- | :--- | :---: |
| **FR-009** | The system shall allow Clinic Administrators to create, view, update, and deactivate doctor profiles. | Must |
| **FR-010** | The system shall store and display each doctor's medical specialty or area of expertise. | Must |
| **FR-011** | The system shall allow Clinic Administrators to assign or unassign one or more medical services to a doctor. | Must |
| **FR-012** | The system shall allow patients to view profiles of active doctors. | Must |
| **FR-013** | The system shall prevent inactive doctors from being selected or receiving new appointment bookings. | Must |

### 4.4 Medical Service Management (M04)

| ID | Functional Requirement | Priority |
| :--- | :--- | :---: |
| **FR-014** | The system shall allow Clinic Administrators to create, view, update, and deactivate medical services. | Must |
| **FR-015** | The system shall store the name, description, and fixed duration (in minutes) of each medical service. | Must |
| **FR-016** | The system shall allow patients to view all active medical services. | Must |
| **FR-017** | The system shall filter and display only active doctors assigned to the selected medical service during booking. | Must |
| **FR-018** | The system shall prevent inactive medical services from being selected for new bookings. | Must |

### 4.5 Doctor Schedule Management (M05)

| ID | Functional Requirement | Priority |
| :--- | :--- | :---: |
| **FR-019** | The system shall allow doctors to define and update their own regular weekly working hours. | Must |
| **FR-020** | The system shall allow doctors to define and update their own recurring break periods and ad-hoc unavailable time periods. | Must |
| **FR-021** | The system shall allow doctors to define their own days off and holidays. | Must |
| **FR-022** | The system shall support schedule exceptions (holidays, breaks, unavailable blocks, or custom working hours) that override regular weekly working hours on specific dates. | Must |
| **FR-023** | The system shall compute available appointment start times based on working hours, breaks, schedule exceptions, existing confirmed appointments, and the selected service duration. | Must |
| **FR-024** | The system shall apply doctor schedule changes immediately when no conflicts exist, and shall block schedule modifications that conflict with existing confirmed appointments unless resolved first. | Must |
| **FR-047** | The system shall allow Clinic Administrators to view, create, update, and manage schedules for all doctors in the clinic. | Must |
| **FR-048** | The system shall allow Clinic Administrators to override or adjust doctor schedule configurations for exceptional cases, subject to conflict validation and audit logging. | Must |

### 4.6 Appointment Management (M06)

| ID | Functional Requirement | Priority |
| :--- | :--- | :---: |
| **FR-025** | The system shall allow patients to select an active medical service, an assigned active doctor, an appointment date, and an available start time. | Must |
| **FR-026** | The system shall generate candidate appointment start times using the configured fixed start interval (default: 15 minutes) and filter them by actual doctor availability. | Must |
| **FR-027** | The system shall display a complete appointment summary for user review prior to booking submission. | Must |
| **FR-028** | The system shall automatically assign the Confirmed status to an appointment immediately upon passing validation and succeeding in database persistence (Instant Confirmation). | Must |
| **FR-029** | The system shall revalidate slot availability on the backend immediately prior to persisting a booking or rescheduling request. | Must |
| **FR-030** | The system shall prevent two or more confirmed appointments from occupying overlapping time ranges for the same doctor. | Must |
| **FR-031** | The system shall allow patients to view their own upcoming and historical appointments. | Must |
| **FR-032** | The system shall allow patients to reschedule their own confirmed appointments subject to the clinic's cutoff policy (default: 24 hours prior) and slot availability. | Must |
| **FR-033** | The system shall allow patients to cancel their own confirmed appointments subject to the clinic's cutoff policy (default: 24 hours prior). | Must |
| **FR-034** | The system shall allow authorized doctors (for assigned appointments) and Clinic Administrators (for all appointments) to update appointment status to Completed or No-show. | Must |
| **FR-035** | The system shall allow Clinic Administrators to view, filter, and manage all clinic appointments. | Must |
| **FR-036** | The system shall record an immutable audit history of all appointment creations, reschedulings, cancellations, and status transitions. | Must |
| **FR-037** | The system shall allow Clinic Administrators to create appointments on behalf of existing registered patients. | Must |
| **FR-049** | The system shall link every administrator-created appointment to the target patient account and record the creating administrator's user ID. | Must |
| **FR-050** | The system shall generate candidate start times at the configured fixed interval (default: 15 minutes) while validating that the entire continuous service duration fits within the doctor's available schedule. | Must |

### 4.7 Notification Management (M07)

| ID | Functional Requirement | Priority |
| :--- | :--- | :---: |
| **FR-038** | The system shall dispatch both in-app and email booking confirmation notifications immediately after an appointment is confirmed. | Must |
| **FR-039** | The system shall dispatch both in-app and email notifications when an appointment is rescheduled or cancelled. | Must |
| **FR-040** | The system shall dispatch scheduled in-app and email appointment reminders prior to the appointment start time. | Should |
| **FR-041** | The system shall track notification delivery statuses (Pending, Sent, Failed) and support retrying failed deliveries without duplicating appointments. | Should |

### 4.8 Clinic Dashboard & Reports (M08)

| ID | Functional Requirement | Priority |
| :--- | :--- | :---: |
| **FR-042** | The system shall provide Clinic Administrators with a dashboard displaying real-time clinic appointment metrics. | Must |
| **FR-043** | The system shall display appointment counts grouped by status (Confirmed, Completed, Cancelled, No-show). | Must |
| **FR-044** | The system shall display a list of upcoming clinic appointments for operational monitoring. | Must |
| **FR-045** | The system shall allow Clinic Administrators to generate summary appointment reports filtered by a custom date range. | Should |
| **FR-046** | The system shall allow doctors to view their own personal dashboard and assigned appointment schedules. | Must |

---

## 5. Business Rules (BR)

### 5.1 Booking Rules

| ID | Business Rule |
| :--- | :--- |
| **BR-001** | Appointments cannot be booked for a date or time in the past relative to the authoritative system clock. |
| **BR-002** | A doctor must be actively assigned to the selected medical service prior to booking. |
| **BR-003** | Only doctors with ACTIVE profile status may receive new appointment bookings. |
| **BR-004** | Only medical services with ACTIVE status may be selected for new appointment bookings. |
| **BR-005** | The selected doctor must have uninterrupted available time covering the entire duration of the selected medical service. |
| **BR-006** | The entire appointment duration (start time to end time) must fall within the doctor's effective working hours for that date. |
| **BR-007** | An appointment must not overlap with any break period, day off, holiday, or schedule exception marked as unavailable. |
| **BR-008** | A doctor cannot have two or more Confirmed appointments with overlapping time intervals. |
| **BR-009** | Slot availability must be revalidated inside the atomic booking transaction to prevent race conditions and double booking. |
| **BR-010** | All mandatory patient profile and booking fields must be provided before an appointment can be created. |
| **BR-011** | Patients may view, reschedule, or cancel only appointments linked to their own account. |
| **BR-012** | Every administrator-created appointment must be associated with a valid existing patient account. |
| **BR-013** | Appointment start times must align with candidate slots generated from the clinic's configured fixed start interval (default: 15 minutes). |
| **BR-014** | A candidate start time is valid for booking only if the full service duration fits continuously within actual doctor availability. |

### 5.2 Schedule Rules

| ID | Business Rule |
| :--- | :--- |
| **BR-015** | Doctors may define regular weekly working hours per day of the week (`start_time < end_time` without overlapping windows on the same day). |
| **BR-016** | Doctors may define one or more break periods within a working day. |
| **BR-017** | Date-specific schedule exceptions take precedence over regular weekly working hours for the affected date and time window. |
| **BR-018** | Schedule modifications must never silently invalidate or overwrite existing Confirmed appointments. |
| **BR-019** | If a doctor becomes unavailable after appointments are confirmed, affected appointments must be explicitly reviewed and resolved (rescheduled or cancelled) by the clinic. |
| **BR-020** | Doctors manage their own schedules with immediate effect when conflict-free; Clinic Administrators hold clinic-wide authority to manage and override any doctor's schedule. |
| **BR-021** | All schedule updates by doctors and administrators must undergo conflict validation against existing Confirmed appointments. |

### 5.3 Cancellation & Rescheduling Rules

| ID | Business Rule |
| :--- | :--- |
| **BR-022** | Patients may cancel or reschedule appointments only before the clinic's configured cutoff deadline prior to the appointment start time. |
| **BR-023** | The default cancellation and rescheduling cutoff period is 24 hours prior to the scheduled appointment start time and is configurable by Clinic Administrators. |
| **BR-024** | Rescheduling an appointment must satisfy all standard booking and availability validation rules (BR-001 through BR-014). |
| **BR-025** | If a rescheduling request fails validation or the target slot is unavailable, the original Confirmed appointment must remain completely unaltered. |
| **BR-026** | Every cancellation and rescheduling action must be recorded in the appointment history with actor and timestamp. |
| **BR-027** | Clinic Administrators may override cutoff restrictions for exceptional cases, provided the override action and reason are recorded in the audit log. |

### 5.4 Appointment Confirmation & Status Rules

The MVP defines four standard appointment statuses (*Pending* and *Rejected* states are excluded due to Instant Confirmation; *Checked-in* is deferred for future consideration):

| Status | Definition | Permitted Transitions & Actors |
| :--- | :--- | :--- |
| **Confirmed** | Appointment is validated, persisted, and scheduled. | → Completed (Doctor/Admin), → Cancelled (Patient/Admin), → No-show (Doctor/Admin), → Confirmed via Reschedule (Patient/Admin) |
| **Completed** | Patient attended and received the scheduled medical service. | Terminal status (no further transitions) |
| **Cancelled** | Appointment was cancelled prior to completion. | Terminal status (no further transitions) |
| **No-show** | Patient failed to attend the scheduled appointment. | Terminal status (no further transitions) |

| ID | Business Rule |
| :--- | :--- |
| **BR-028** | Any booking passing all validation rules and database persistence shall be assigned the Confirmed status automatically. |
| **BR-029** | No manual administrator approval step is required to confirm a valid patient booking. |
| **BR-030** | Completed, Cancelled, and No-show are terminal statuses and cannot transition back to Confirmed. |
| **BR-031** | Rescheduling changes the appointment's start and end timestamps while retaining its Confirmed status. |
| **BR-032** | Only authorized users (assigned Doctor or Clinic Administrator) may mark an appointment as Completed or No-show. |
| **BR-033** | Every status transition must be logged with the responsible user's ID and UTC timestamp. |

---

## 6. Non-Functional Requirements (NFR)

Each Non-Functional Requirement specifies a measurable target, a practical verification method, and the target Sprint in which verification is executed.

### 6.1 Security & Privacy

| ID | Non-Functional Requirement | Priority | Practical Verification Method | Target Sprint |
| :--- | :--- | :---: | :--- | :---: |
| **NFR-001** | The system shall hash all user passwords using Argon2id; zero plaintext passwords shall be stored or logged. | Must | Unit test on password hashing utility + DB record inspection of seeded/created users | Sprint 1 |
| **NFR-002** | The system shall enforce Role-Based Access Control (RBAC) on the backend for 100% of protected routes and API endpoints. | Must | Automated API integration tests sending unauthenticated (`401`) and unauthorized-role (`403`) requests across all protected endpoints | Sprint 1 |
| **NFR-003** | The system shall verify resource ownership or doctor assignment before executing any profile or appointment operation. | Must | Automated API integration tests verifying cross-user access attempts are rejected (`403`/`404`) | Sprint 1 & 2 |
| **NFR-004** | The system shall prevent unauthorized users from reading or enumerating personal profiles or appointments belonging to other users. | Must | Automated API negative tests attempting cross-patient ID access without returning private data | Sprint 1 & 2 |
| **NFR-005** | The system shall encrypt all data in transit using HTTPS (TLS 1.2 or higher) in deployed environments. | Must | Configuration inspection of Nginx/Cloud Run TLS settings and live HTTPS endpoint check | Lab 5 / Sprint 3 |
| **NFR-006** | The system shall sanitize application logs and error responses to expose zero passwords, tokens, or stack traces. | Must | Automated API error-response assertion tests and log output inspection during test runs | Sprint 1 |
| **NFR-007** | The system shall collect and retain only personal data strictly required for account and appointment management. | Must | Database schema audit (`prisma/schema.prisma`) confirming absence of clinical/EMR fields | Sprint 1 |
| **NFR-008** | The system shall process and protect personal data in compliance with Thailand's PDPA and applicable privacy regulations. | Must | Security & privacy checklist review verifying data minimization, RBAC isolation, and secret hygiene | Sprint 1 |

### 6.2 Performance

| ID | Non-Functional Requirement | Priority | Practical Verification Method | Target Sprint |
| :--- | :--- | :---: | :--- | :---: |
| **NFR-009** | Under normal clinic operating load (up to 20 concurrent users), 95% of standard REST API requests shall respond within 2 seconds (`p95 < 2000ms`). | Should | Automated API response-time measurement during integration test suite execution | Sprint 2 & 3 |
| **NFR-010** | Doctor availability slot queries shall return computed results within 2 seconds (`p95 < 2000ms`) under normal operating load. | Should | Timed API integration test querying `/api/v1/doctors/:id/availability` across populated schedules | Sprint 2 |
| **NFR-011** | Concurrent booking transactions shall execute atomically with zero conflicting Confirmed appointments permitted. | Must | Concurrent API stress test firing parallel `POST /api/v1/appointments` requests for the identical slot | Sprint 2 |

### 6.3 Reliability & Data Integrity

| ID | Non-Functional Requirement | Priority | Practical Verification Method | Target Sprint |
| :--- | :--- | :---: | :--- | :---: |
| **NFR-012** | Appointment creation and rescheduling shall execute within atomic PostgreSQL transactions with GiST exclusion constraints to prevent double booking. | Must | Database integration test verifying `23P01` exclusion constraint enforcement (`409 Conflict`) on overlapping intervals | Sprint 2 |
| **NFR-013** | A failed rescheduling operation shall roll back cleanly, leaving the original Confirmed appointment 100% unaltered. | Must | API integration test submitting an invalid reschedule target and asserting original appointment timestamps remain unchanged | Sprint 2 |
| **NFR-014** | Historical appointment records shall store service name and duration snapshots so records remain intact if a service is later modified or deactivated. | Must | API/DB integration test modifying a service duration after booking and verifying historical snapshot immutability | Sprint 2 |
| **NFR-015** | The system shall maintain an immutable audit trail of schedule overrides and appointment status changes. | Must | API/DB integration tests verifying `AuditLog` and `AppointmentHistory` rows are inserted with actor ID and UTC timestamp | Sprint 1 & 2 |
| **NFR-016** | External email delivery failures shall be isolated and shall never roll back a confirmed appointment transaction. | Must | Integration test simulating email provider failure and asserting appointment remains `CONFIRMED` in PostgreSQL | Sprint 3 |
| **NFR-017** | The system shall support retrying failed notification deliveries asynchronously without creating duplicate appointments. | Should | Integration test triggering retry worker on `FAILED` notifications and verifying single appointment count | Sprint 3 |
| **NFR-018** | The system shall enforce idempotency on booking submissions (`Idempotency-Key`) to prevent duplicate appointments on network retries. | Should | API integration test sending duplicate `POST /api/v1/appointments` requests with identical `Idempotency-Key` | Sprint 2 |

### 6.4 Usability & Accessibility

| ID | Non-Functional Requirement | Priority | Practical Verification Method | Target Sprint |
| :--- | :--- | :---: | :--- | :---: |
| **NFR-019** | The patient booking and schedule management workflows shall provide a clear, step-by-step guided interface. | Must | End-to-End (E2E) Playwright UI journey test and visual UI walkthrough | Sprint 1 & 2 |
| **NFR-020** | The system shall display clear, actionable UI feedback for all successful operations, validation errors, loading, and empty states. | Must | Playwright E2E UI assertions verifying toast confirmations, inline validation messages, and empty states | Sprint 1 & 2 |
| **NFR-021** | The UI shall clearly distinguish available, selected, unavailable, and past time slots and explain booking conflicts. | Must | Playwright E2E UI test verifying distinct visual states/attributes for slot buttons | Sprint 2 |
| **NFR-022** | The web application shall provide a responsive layout compatible with desktop (`1280x800`) and mobile (`375x812`) viewports without horizontal overflow. | Must | Playwright viewport resize check across desktop and mobile screen dimensions | Sprint 1 & 2 |
| **NFR-023** | The system shall maintain consistent navigation, terminology, and interaction patterns across all user roles. | Should | Cross-role UI inspection across Patient, Doctor, and Admin portals | Sprint 1 |

### 6.5 Maintainability & Compatibility

| ID | Non-Functional Requirement | Priority | Practical Verification Method | Target Sprint |
| :--- | :--- | :---: | :--- | :---: |
| **NFR-024** | The codebase shall follow a modular three-tier architecture separating presentation, business logic, and data access layers. | Should | Codebase directory & architecture review (`client/src/`, `server/src/modules/`, `server/prisma/`) | Sprint 1 |
| **NFR-025** | 100% of client inputs shall be strictly validated on the backend server regardless of client-side validation. | Must | Direct API integration tests bypassing the UI with malformed payloads asserting `400`/`422` responses | Sprint 1 & 2 |
| **NFR-026** | The frontend application shall run cleanly in current versions of major modern web browsers (Chromium/Chrome, Firefox, WebKit/Safari). | Should | Playwright E2E test execution in headless Chromium | Sprint 1 |
| **NFR-027** | The system shall store all timestamps in UTC (`TIMESTAMPTZ`) and convert date/time values consistently to the clinic's configured local timezone (default: `Asia/Bangkok`, UTC+7) for display. | Must | Unit tests on UTC/timezone conversion helpers + DB timestamp inspection (`Z` / UTC offset) | Sprint 1 & 2 |

---

## 7. Architectural Decisions & System Assumptions

### 7.1 Confirmed Architectural & Product Decisions

| ID | Decision Area | Confirmed Baseline | Status |
| :--- | :--- | :--- | :---: |
| **DEC-001** | Organization Model | Single Clinic / Single Organization | Confirmed |
| **DEC-002** | Application Type | Responsive Web Application | Confirmed |
| **DEC-003** | User Roles | Patient, Doctor, Clinic Administrator | Confirmed |
| **DEC-004** | Booking Confirmation Model | Instant Confirmation (no manual approval queue) | Confirmed |
| **DEC-005** | Booking Selection Sequence | Patient selects Medical Service first, then an assigned Doctor | Confirmed |
| **DEC-006** | Schedule Governance | Doctors manage own schedules (immediate effect if conflict-free); Administrators have clinic-wide control and override authority | Confirmed |
| **DEC-007** | Admin-Assisted Booking | Administrators can create appointments on behalf of registered patients under identical validation rules | Confirmed |
| **DEC-008** | Time Slot Generation Model | Hybrid Time Slot: configurable fixed start interval (default: 15 minutes) validated against actual continuous availability and full service duration | Confirmed |
| **DEC-009** | Appointment Lifecycle Statuses | Confirmed, Completed, Cancelled, No-show | Confirmed |
| **DEC-010** | Cancellation / Rescheduling Policy | Default cutoff of 24 hours prior to appointment start time; configurable by Clinic Administrator | Confirmed |
| **DEC-011** | Database Management System | Relational Database — PostgreSQL | Confirmed |
| **DEC-012** | Access Control Mechanism | Role-Based Access Control (RBAC) enforced at backend API and data layers | Confirmed |
| **DEC-013** | Notification Channels | Both In-App Notifications and Email Notifications supported in MVP | Confirmed |
| **DEC-014** | Online Payment | Excluded from MVP | Confirmed |
| **DEC-015** | Medical / Clinical Records | Excluded from MVP | Confirmed |
| **DEC-016** | Timezone & Timestamp Policy | Store all timestamps in UTC; display in clinic local timezone (default: `Asia/Bangkok`, UTC+7) | Confirmed |
| **DEC-017** | Sprint 1 Account Provisioning | Sprint 1 uses reproducible seeded test accounts (`PATIENT`, `DOCTOR`, `ADMIN`) for authentication and RBAC verification; self-registration and password recovery are deferred to Sprint 2 | Confirmed |

### 7.2 System Assumptions

| ID | Assumption |
| :--- | :--- |
| **ASM-001** | The MVP serves a single clinic organization and does not require multi-tenant data isolation. |
| **ASM-002** | The clinic employs multiple doctors and offers multiple distinct medical services. |
| **ASM-003** | Each medical service has a single predefined duration in minutes. |
| **ASM-004** | Medical services and doctors have a many-to-many relationship (one service can be provided by multiple doctors; one doctor can provide multiple services). |
| **ASM-005** | A doctor must be explicitly assigned to a service by an administrator before appearing as eligible for that service. |
| **ASM-006** | Users authenticate with provisioned accounts (seeded in Sprint 1; self-registered in Sprint 2+) to access role-specific workflows. |
| **ASM-007** | At least one active Clinic Administrator account exists to configure and administer the clinic. |
| **ASM-008** | Doctors maintain regular weekly working schedules that can be modified by date-specific schedule exceptions. |
| **ASM-009** | The system strictly manages appointment scheduling and does not perform clinical diagnosis, treatment, or EMR storage. |
| **ASM-010** | Email delivery relies on an external third-party email service provider and must tolerate transient delivery failures. |
| **ASM-011** | Appointment end time is deterministically calculated as start time plus the selected service's duration. |
| **ASM-012** | All business cutoff rules and schedule displays are evaluated in the clinic's configured local timezone (default: `Asia/Bangkok`, UTC+7). |
| **ASM-013** | Patient personal data is restricted to fields strictly necessary for account identification, communication, and appointment booking. |
| **ASM-014** | Both Doctors and Clinic Administrators can update doctor schedules within their respective RBAC boundaries and conflict validation rules. |
| **ASM-015** | The fixed start interval defaults to 15 minutes and can be reconfigured by a Clinic Administrator. |
| **ASM-016** | Administrator-created appointments are associated with existing patient accounts. |
| **ASM-017** | Self-service patient bookings and administrator-assisted bookings execute the exact same backend availability and concurrency validation pipeline. |

---
*End of Appointly Software Requirements Specification (SRS) & Product Scope — Version 1.0*