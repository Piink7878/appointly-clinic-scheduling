# Appointly — Three-Sprint Implementation Plan

* **Product Name:** Appointly
* **System Name:** Clinic Appointment & Scheduling Management System
* **Document Version:** 1.0 — Deliverable 1 Baseline Confirmed
* **Reference Documents:** SRS & Product Scope v1.0; Feature Inventory & Traceability v1.0; System-Level SDS v1.0
* **Project Type:** Responsive Web Application
* **System Scope:** Single Clinic / Single Organization
* **Status:** Engineering Baseline Approved

---

## 1. Three-Sprint Development Plan & Scope Rationale

### 1.1 Three-Sprint Roadmap Overview

The Appointly MVP is structured into three sequential, dependency-driven Sprints delivering all 19 product features (`F-001` through `F-019`) across all 8 system modules (`M01` through `M08`).

| Sprint | Sprint Name | Allocated Features | Core Modules | Required Outcome & Course Checkpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Sprint 1** | System Foundation & Clinic Configuration | `F-001` (Core), `F-002` (Core), `F-003`, `F-004`, `F-005`, `F-006`, `F-007` | M01, M02, M03, M04, M05 | Working domain vertical slice (Auth/RBAC with seeded accounts, Doctor/Service catalogs, Doctor-Service assignment, Doctor Self-Schedule with conflict validation, and Clinic Settings) persisted in PostgreSQL.<br>**Checkpoint:** Project Deliverable 1 (Due 8 Nov 2026) & Lab 5 Cloud Deployment (Due 15 Nov 2026). |
| **Sprint 2** | Availability & Appointment Management | `F-001` (Ext.), `F-002` (Ext.), `F-008`, `F-009`, `F-010`, `F-011`, `F-012`, `F-013`, `F-014`, `F-015` | M01, M02, M05, M06 | Completed core expansion: self-registration & password recovery, schedule conflict validation against bookings, 15-min Hybrid Time Slot engine, atomic patient/admin booking, PostgreSQL GiST double-booking prevention, rescheduling/cancellation (24h cutoff), and status/history audit trail.<br>**Checkpoint:** Project Deliverable 2 (Due 29 Nov 2026). |
| **Sprint 3** | Notifications & Clinic Insights | `F-016`, `F-017`, `F-018`, `F-019` | M07, M08 | Remaining features, integration, and product hardening: decoupled In-App + Email notifications, scheduled reminders, asynchronous delivery retry worker, real-time clinic dashboard, and custom date-range statistical reports.<br>**Checkpoint:** Progress on 29 Nov; Final Project Release (Due 13 Dec 2026). |

### 1.2 Cross-Sprint & Cross-Feature Dependencies

```text
SPRINT 1: FOUNDATION & CLINIC CONFIGURATION (F-001 to F-007)
  [F-001: Auth & RBAC (Seeded Accounts, Login/Logout/Me)]
     ├──> [F-002: Patient Profile & Directory]
     ├──> [F-003: Doctor Profile Management] ──┐
     ├──> [F-004: Medical Service Catalog]   ──┼──> [F-005: Doctor-Service Assignment (Domain Journey B)]
     ├──> [F-006: Doctor Self-Schedule Mgmt (Domain Journey A — Immediate Effect & Overlap Rejection)]
     └──> [F-007: Admin Schedule & Clinic Configuration (15m interval, 24h cutoff, Asia/Bangkok)]
                                                          │
                                                          ▼
SPRINT 2: AVAILABILITY & APPOINTMENT MANAGEMENT (F-008 to F-015 + Auth/Account Extensions)
  [F-008: Schedule Conflict Management] <── (Validates against Confirmed Appointments)
  [F-009: Availability & Hybrid Time Slot Engine (15m interval + duration fit)]
     ├──> [F-010: Patient Appointment Booking] ──┐
     └──> [F-012: Admin-Assisted Booking]      ──┼──> [F-011: Double Booking Prevention (GiST)]
                                                 ├──> [F-013: Appointment Viewing & Mgmt]
                                                 ├──> [F-014: Rescheduling & Cancellation (24h)]
                                                 └──> [F-015: Appointment Status & History]
                                                          │
                                                          ▼
SPRINT 3: NOTIFICATIONS & CLINIC INSIGHTS (F-016 to F-019)
  [F-016: Appointment Notifications (In-App + Email)] ──> [F-017: Delivery Tracking & Reminders]
  [F-018: Clinic Operational Dashboard] & [F-019: Date-Range Appointment Reports]
```

| Feature ID | Feature Name | Target Sprint | Prerequisite Features | Dependency Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **F-001** | Authentication & Role Management | Sprint 1 (Core) / Sprint 2 (Ext.) | None (Root Foundation) | All protected UI routes and REST API endpoints require identity and RBAC enforcement |
| **F-002** | Patient Profile Management | Sprint 1 (Core) / Sprint 2 (Ext.) | F-001 | Requires authenticated User records and ownership guards |
| **F-003** | Doctor Profile Management | Sprint 1 | F-001 | Requires Admin RBAC authorization and User account linkage |
| **F-004** | Medical Service Catalog | Sprint 1 | F-001 | Requires Admin RBAC authorization to manage service catalog |
| **F-005** | Doctor-Service Assignment | Sprint 1 | F-003, F-004 | Requires persisted Doctor and MedicalService entities before creating many-to-many links |
| **F-006** | Doctor Self-Schedule Management | Sprint 1 | F-001, F-003 | Requires authenticated Doctor profile to configure weekly hours and exceptions |
| **F-007** | Administrator Schedule & Clinic Configuration | Sprint 1 | F-001, F-003 | Requires Admin RBAC and Doctor entities to govern clinic-wide schedules and singleton settings |
| **F-008** | Schedule Conflict Management | Sprint 2 | F-006, F-007, F-015 | Validates schedule changes against confirmed Appointment records |
| **F-009** | Availability & Hybrid Time Slot Engine | Sprint 2 | F-003, F-004, F-005, F-006, F-007 | Computes bookable slots from active services, assigned doctors, schedules, exceptions, and clinic interval/timezone |
| **F-010** | Patient Appointment Booking | Sprint 2 | F-002, F-005, F-009 | Requires patient profile, service-doctor assignment, and valid candidate slots |
| **F-011** | Double Booking Prevention | Sprint 2 | F-009, F-010 | Wraps booking persistence in atomic PostgreSQL transactions and GiST exclusion constraints |
| **F-012** | Administrator-Assisted Booking | Sprint 2 | F-002, F-005, F-009, F-011 | Reuses the exact availability and concurrency pipeline on behalf of an existing patient |
| **F-013** | Appointment Viewing & Management | Sprint 2 | F-001, F-010, F-012 | Queries persisted appointments filtered by role ownership/assignment |
| **F-014** | Appointment Rescheduling & Cancellation | Sprint 2 | F-007, F-009, F-011, F-013 | Revalidates new slots atomically and enforces the configurable 24-hour cutoff policy |
| **F-015** | Appointment Status & History | Sprint 2 | F-010, F-012, F-014 | Logs immutable state transitions (Confirmed, Completed, Cancelled, No-show) and overrides |
| **F-016** | Appointment Notifications | Sprint 3 | F-010, F-012, F-014 | Triggered asynchronously by booking confirmation, rescheduling, and cancellation events |
| **F-017** | Notification Delivery & Reminders | Sprint 3 | F-007, F-016 | Uses clinic reminder lead time and notification records for cron reminders and retries |
| **F-018** | Clinic Dashboard | Sprint 3 | F-013, F-015 | Aggregates real-time appointment volume and status distributions |
| **F-019** | Appointment Reports | Sprint 3 | F-013, F-015 | Generates date-range summary statistics from historical appointment data |

### 1.3 Engineering Rationale for Sprint 1 Scope Selection (F-001 to F-007)

Selecting `F-001` through `F-007` (with seeded test accounts per `DEC-017`) for Sprint 1 is driven by four architectural and delivery imperatives:

1. **Zero Forward-Dependency Violation:** An appointment cannot exist without five prerequisite domain entities: an authenticated User/Patient (`F-001`, `F-002`), an active Doctor (`F-003`), an active Medical Service with a fixed duration (`F-004`), an explicit Doctor-Service assignment (`F-005`), and a defined working schedule with clinic timezone/interval parameters (`F-006`, `F-007`).
2. **Complete Deliverable 1 Vertical Slice & Domain Journeys:** Sprint 1 establishes two end-to-end domain journeys across React UI → Express API → PostgreSQL:
   * **Primary Journey (`F-006` — Doctor Self-Schedule Management):** A Doctor logs in, defines regular weekly working shifts (including split shifts) and date-specific exceptions, and retrieves the persisted schedule. Attempting to save overlapping or inverted windows (`start_time >= end_time`) triggers a deterministic backend rule rejection (`422 INVALID_SCHEDULE_WINDOW`).
   * **Secondary Journey (`F-005` — Doctor-Service Assignment):** A Clinic Administrator links active doctors to active medical services and filters eligible doctors by service (`GET /api/v1/doctors?serviceId=...`). Duplicate assignments are rejected with `409 Conflict` (`DUPLICATE_ASSIGNMENT`).
3. **Feasible Scope Within Checkpoint Deadline:** Deferring patient self-registration, password recovery, and advanced account administration to Sprint 2 (using reproducible seeded test accounts across `PATIENT`, `DOCTOR`, and `ADMIN` roles) keeps Sprint 1 focused on core RBAC enforcement (`401`/`403`) and domain persistence without schedule overrun.
4. **Cloud-Ready Foundation for Lab 5:** All Sprint 1 configurations are externalized via environment variables and persisted in PostgreSQL 16, enabling seamless Docker packaging and GCP Cloud Run + Cloud SQL deployment in Lab 5 without refactoring application logic.

---

## 2. Deliverable & Checkpoint Alignment Matrix

### 2.1 Course Deliverable & Lab Schedule

| Checkpoint | Due Date | Required Engineering Artifacts | Verification Scope |
| :--- | :--- | :--- | :--- |
| **Project Deliverable 1** | 8 Nov 2026 | Self-contained PDF containing Parts A–E (Baseline Specs & Sprint 1 Contracts) + Part F (Working Sprint 1 local release on `main`, test results, GitHub Issues/PRs, contribution table). | Local build, Prisma migrations/seed, automated Unit/API/E2E tests, and local UI walkthrough. |
| **Lab 5: Cloud Deployment & CI/CD** | 15 Nov 2026 | Public GitHub repository with `Dockerfile`, `.dockerignore`, `.env.example`, `.github/workflows/ci-docker.yml`, `deploy.yml`, and `docs/labs/lab-05/deployment.md` + Lab 5 Evidence PDF. | Container build from clean clone, PR CI required check blocking failing merges, live GCP Cloud Run + Cloud SQL persistence across restart/redeploy (`C-01` to `C-06`). |
| **Project Deliverable 2** | 29 Nov 2026 | Sprint 2 Engineering Contracts + Working Sprint 2 Increment (`F-008` to `F-015` + `F-001`/`F-002` extensions) deployed through CI/CD pipeline. | Hybrid Time Slot engine, atomic booking, PostgreSQL GiST double-booking prevention, 24h cutoff rescheduling/cancellation, and audit history. |
| **Final Project Release** | 13 Dec 2026 | Sprint 3 Engineering Contracts + Complete MVP (`F-001` to `F-019`) + Final Demonstration Video & Project Report. | Dual In-App & Email notifications, async retry worker, clinic dashboard, date-range reports, and full system regression. |

### 2.2 Sprint 1 Deliverable Checklist (Project Deliverable 1 — Parts A to F)

* **Part A (`specs/01-srs-and-product-scope.md`):** Complete SRS with actors, scope/exclusions, `FR-001`–`FR-050`, `BR-001`–`BR-033`, `NFR-001`–`NFR-027` (with verification methods and sprint allocations), and `DEC-001`–`DEC-017`.
* **Part B (`specs/02-feature-inventory-traceability.md`):** Complete 19-feature inventory, bidirectional traceability matrices, `Coverage Gaps = 0` verification, and approved baseline changes (`CHG-001`, `CHG-002`).
* **Part C (`specs/03-system-level-sds.md`):** Complete System-Level SDS with three-tier architecture, 12 relational entities, UI/API conventions, 4-gate RBAC matrix, Argon2id/HttpOnly JWT security, environment variables, and planned GCP components.
* **Part D (`specs/04-three-sprint-plan.md`):** Three-sprint roadmap, cross-feature dependencies, Sprint 1 scope rationale, and checkpoint alignment.
* **Part E (`specs/sprints/sprint-1-contracts.md`):** Versioned Sprint 1 feature contracts (`F-001`–`F-007`), measurable Acceptance Criteria (`AC-F001-*` to `AC-F007-*`), Software Test Specification (`STS-S1-001` to `STS-S1-009`), and Sprint 1 Definition of Done.
* **Part F (Working Release & Execution Evidence):** Tagged release commit on `main`, local setup summary, labeled UI/API/DB demonstration screenshots, automated test execution logs/excerpts, and GitHub Issue/PR/review/contribution records.

---
*End of Appointly Three-Sprint Implementation Plan — Version 1.0*