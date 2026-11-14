# Appointly — Lab 5 Cloud Deployment & CI/CD Runbook

* **System Name:** Appointly (Clinic Appointment & Scheduling Management System)
* **Cloud Platform:** Google Cloud Platform (GCP)
* **Target Services:** Cloud Run (Web & API), Cloud SQL (PostgreSQL 16), Secret Manager, Artifact Registry
* **CI/CD Platform:** GitHub Actions with Workload Identity Federation (OIDC)
* **Reference Specifications:** System-Level SDS Section 8 (`specs/03-system-level-sds.md`)

---

## 1. Cloud Architecture & Topology

Appointly deploys to Google Cloud Platform using serverless, containerized micro-architecture:

```text
                        [ End Users / TAs ]
                                 │
                          HTTPS (Public URL)
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
    [ Cloud Run: Frontend SPA ]    [ Cloud Run: Backend REST API ]
     (Nginx + Built React SPA)       (Node.js + Express + TypeScript)
      min-instances: 0                min-instances: 0
                                           │
                         ┌─────────────────┼─────────────────┐
                         ▼                 ▼                 ▼
             [ Cloud SQL: PostgreSQL ] [ Secret Manager ] [ External Email ]
               (db-f1-micro, PG 16)     (DB URL & JWTs)    (SMTP / Mock)
```

### Component Breakdown

| GCP Component | Role in Architecture | Scaling & Cost Configuration |
| :--- | :--- | :--- |
| **Cloud Run API** (`appointly-api`) | Serves RESTful API endpoints (`/api/v1/*`) and health checks | `min-instances=0`, `max-instances<=3` (scales to zero to conserve credits) |
| **Cloud Run Web** (`appointly-web`) | Nginx container serving compiled React SPA | `min-instances=0`, `max-instances<=3` |
| **Cloud SQL for PostgreSQL 16** | Relational database with ACID transactions and `btree_gist` | `db-f1-micro` (`--edition=enterprise`), daily backups, storage auto-increase disabled |
| **Artifact Registry** | Stores immutable Docker container images | Tagged with full Git commit SHA (`git rev-parse HEAD`) |
| **Secret Manager** | Secures runtime secrets | Injected into Cloud Run environment without hardcoding in Git |
| **Cloud Run Job** (`appointly-migrate`) | Executes database migrations (`prisma migrate deploy`) and seed | Executed prior to container traffic switch |

---

## 2. Environment Variables & Secret Configuration

Runtime configuration is strictly separated between public variables and encrypted secrets in Secret Manager:

### 2.1 Backend Environment Variables

| Variable Name | Type | Description | Source in Production |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Variable | Runtime environment (`production`) | Cloud Run Environment |
| `PORT` | Variable | Server port (`8080` or `3000`) | Cloud Run Injected |
| `DATABASE_URL` | **Secret** | PostgreSQL 16 connection string | GCP Secret Manager |
| `JWT_ACCESS_SECRET` | **Secret** | 15-minute Access Token cryptographic secret | GCP Secret Manager |
| `JWT_REFRESH_SECRET` | **Secret** | 7-day Refresh Token cryptographic secret | GCP Secret Manager |
| `CORS_ORIGIN` | Variable | Allowed frontend origin URL | Cloud Run Environment |
| `COOKIE_SECURE` | Variable | Boolean flag (`true` for HTTPS in production) | Cloud Run Environment |
| `CLINIC_DEFAULT_TIMEZONE` | Variable | Default clinic timezone (`Asia/Bangkok`) | Cloud Run Environment |
| `SEED_ADMIN_EMAIL` | Variable | Administrator account seed identifier | Cloud Run Environment |
| `SEED_DEFAULT_PASSWORD` | **Secret** | Seed account temporary password | GCP Secret Manager |

### 2.2 Frontend Environment Variables

| Variable Name | Type | Description | Source in Production |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | Variable | Base API URL (e.g. `/api/v1` or public backend URL) | Vite Build Argument |
| `VITE_API_URL` | Variable | Public API base URL for Nginx proxy | Docker Build Argument |

---

## 3. GitHub Actions CI/CD Pipeline

The repository integrates two automated GitHub Actions workflows:

1. **`ci-docker.yml` (CI & Container Build Verification):**
   * Triggered on every Pull Request targeting `main`.
   * Spawns a temporary PostgreSQL 16 test container.
   * Runs deployment script offline syntax checks (`deploy/tests/`).
   * Runs backend migrations, seed, and tests (`server/`).
   * Runs frontend tests and Vite production build (`client/`).
   * Verifies multi-stage `Dockerfile` compilation.

2. **`deploy.yml` (Automated GCP Deployment):**
   * Triggered automatically upon merge into `main`.
   * Authenticates using **Workload Identity Federation (OIDC)** (no stored JSON service account keys).
   * Builds and pushes immutable Docker images tagged with Git commit SHA to Artifact Registry.
   * Executes Cloud Run migration job (`appointly-migrate`).
   * Deploys new revision to Cloud Run.
   * Executes automated smoke test (`deploy/smoke_test.py`) against live service URL.

---

## 4. Deployment & Rollback Runbook

### 4.1 First Deploy Setup (Cloud Shell)

```bash
# 1. Preview changes with dry-run
DRY_RUN=1 PROJECT_ID=YOUR_PROJECT_ID bash deploy/deploy.sh

# 2. Execute live cloud deployment
PROJECT_ID=YOUR_PROJECT_ID bash deploy/deploy.sh
```

### 4.2 Automated Rollback Procedure

If a deployed revision introduces a regression:
1. Navigate to **GitHub Actions** > **Deploy demo** workflow.
2. Click **Run workflow** on the `main` branch.
3. In the `image_tag` input, paste the full 40-character commit SHA of the last known healthy release.
4. The workflow will bypass tests/build, redeploy the tagged image digest directly, and run live smoke tests.

---

## 5. Teardown Procedure

At the conclusion of the course/lab evaluation:

```bash
PROJECT_ID=YOUR_PROJECT_ID bash deploy/teardown.sh
```
This terminates the Cloud Run services, deletes the Cloud SQL database instance, and removes the Artifact Registry repository to eliminate recurring cloud costs.

