# Appointly — Lab 5 Cloud Deployment & CI/CD Runbook

* **System Name:** Appointly (Clinic Appointment & Scheduling Management System)
* **Cloud Platform:** Google Cloud Platform (GCP) — Shared Course Project (`cpe-se-course-2026`)
* **Region:** `asia-southeast1`
* **Resource Prefix / Group ID:** `s96ba5182`
* **Target Services:** Cloud Run (Unified Web & API), Cloud Run Jobs (Migration & Seed), Cloud SQL (PostgreSQL 16), Secret Manager, Artifact Registry
* **CI/CD Platform:** GitHub Actions with Workload Identity Federation (OIDC)
* **Reference Specifications:** System-Level SDS Section 8 (`specs/03-system-level-sds.md`)

---

## 1. Cloud Architecture & Shared Course Infrastructure

Appointly deploys to Google Cloud Platform under the centralized **Shared Course Project (`cpe-se-course-2026`)** in region `asia-southeast1`. Rather than creating a personal GCP project or provisioning infrastructure manually, all foundational resources are pre-provisioned via the Course Portal using the team prefix **`s96ba5182`**.

```text
                        [ End Users / TAs ]
                                 │
                          HTTPS (Public URL)
                                 │
                                 ▼
                   [ Cloud Run Service: s96ba5182 ]
               (Unified Node.js + Express + React SPA)
                    port: 3000, min: 0, max: 1
                                 │
                ┌────────────────┼────────────────┐
                ▼                ▼                ▼
     [ Cloud SQL: s96ba5182-pg ] [ Secret Manager ] [ External Email ]
        (PostgreSQL 16)          (DB URL, Admin,     (Mock / SMTP)
                                  Demo & App Secrets)
                ▲
                │
     [ Cloud Run Job: s96ba5182-migrate ]
     (Prisma migrate deploy & seed)
```

### Pre-provisioned Course Resources

The following infrastructure components are created and managed by the Course Portal:

| Component | Resource Identifier | Configuration & Purpose |
| :--- | :--- | :--- |
| **Cloud Run Service** | `s96ba5182` | Unified container serving React SPA static files and Express REST API on port `3000` (`min-instances=0`, `max-instances=1`) |
| **Cloud Run Migration Job** | `s96ba5182-migrate` | Runs database schema migrations (`npx prisma migrate deploy`) and idempotent data seeding (`npm run prisma:seed`) prior to traffic routing |
| **Cloud SQL for PostgreSQL 16** | `s96ba5182-pg` | Instance connection: `cpe-se-course-2026:asia-southeast1:s96ba5182-pg`<br>Database: `s96ba5182`, User: `s96ba5182` |
| **Artifact Registry** | `asia-southeast1-docker.pkg.dev/cpe-se-course-2026/s96ba5182/s96ba5182` | Dedicated container repository for immutable Docker images tagged with Git commit SHA |
| **Runtime Service Account** | `s96ba5182-runner@cpe-se-course-2026.iam.gserviceaccount.com` | Least-privilege identity used by Cloud Run service and migration job to access Cloud SQL and Secret Manager |
| **Deployer Service Account** | `s96ba5182-deployer@cpe-se-course-2026.iam.gserviceaccount.com` | Identity assumed by GitHub Actions via Workload Identity Federation (WIF) to push images and update Cloud Run |
| **Core Secrets** | `s96ba5182-database-url`<br>`s96ba5182-admin-password`<br>`s96ba5182-demo-password` | Pre-created secrets in Secret Manager with read access bound to `s96ba5182-runner` |
| **App Secret Slots** | `s96ba5182-app-secret-1` ถึง `5` | 5 pre-created application secret slots for custom application secrets (e.g., JWT tokens) |

---

## 2. Environment Variables & Secret Configuration

Runtime configuration is strictly separated between environment variables and encrypted secrets in Secret Manager.

### 2.1 Cloud Run Service & Job Variables

| Variable / Secret | Type | Mapping / Secret Name | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Variable | `production` | Production runtime flag |
| `TZ` | Variable | `Asia/Bangkok` | Clinic timezone for date-time handling |
| `COOKIE_SECURE` | Variable | `true` | Enforces HTTPS-only secure cookies |
| `TRUST_PROXY` | Variable | `1` | Enables reverse-proxy header trust behind Google Cloud Run |
| `PORT` | Variable | `3000` | Port exposed by unified container |
| `DATABASE_URL` | **Secret** | `s96ba5182-database-url:latest` | Cloud SQL PostgreSQL connection string |
| `ADMIN_PASSWORD` | **Secret** | `s96ba5182-admin-password:latest` | Production administrator password for `admin@appointly.local` |
| `DEMO_USER_PASSWORD` | **Secret** | `s96ba5182-demo-password:latest` | Dedicated test/demo accounts password (active when `SEED_DEMO_DATA=true`) |
| `JWT_ACCESS_SECRET` | **Secret** | `s96ba5182-app-secret-1:latest` | Cryptographic secret for signing 15-minute Access Tokens |
| `JWT_REFRESH_SECRET` | **Secret** | `s96ba5182-app-secret-2:latest` | Cryptographic secret for signing 7-day Refresh Tokens |
| `SEED_DEMO_DATA` | Variable | `false` (or `true` with `--demo`) | Controls whether synthetic demo accounts are seeded |
| `ADMIN_PASSWORD_RESET` | Variable | `false` | One-shot admin password hash rotation flag |

> [!NOTE]
> **Production Seeding Policy:** The seed script (`server/prisma/seed.ts`) operates on a create-if-missing basis in production. It creates the primary administrator (`admin@appointly.local`) and essential clinic settings, and will throw an error if neither `SEED_DEFAULT_PASSWORD` nor `ADMIN_PASSWORD` is supplied.

### 2.2 Prerequisites: JWT Secrets Setup in Secret Manager

The Course Portal pre-provisions 5 application secret slots: `s96ba5182-app-secret-1` through `s96ba5182-app-secret-5`, with read permissions already granted to the runtime service account (`s96ba5182-runner`).

* Student accounts do not have permission to `describe` or read existing secret payloads back from Secret Manager.
* Student accounts **do** have permission to add new secret versions.

**Before running the first live deployment**, you must initialize versions for `JWT_ACCESS_SECRET` (`app-secret-1`) and `JWT_REFRESH_SECRET` (`app-secret-2`) via Google Cloud Shell:

```bash
# Generate and add JWT Access Token secret
openssl rand -hex 32 | gcloud secrets versions add s96ba5182-app-secret-1 --data-file=- --project cpe-se-course-2026

# Generate and add JWT Refresh Token secret
openssl rand -hex 32 | gcloud secrets versions add s96ba5182-app-secret-2 --data-file=- --project cpe-se-course-2026
```

---

## 3. GitHub Actions CI/CD Pipeline

The repository integrates two automated GitHub Actions workflows:

1. **`ci-docker.yml` (CI & Container Build Verification):**
   * Triggered on every Pull Request targeting `main` or `staging`.
   * Spawns a temporary PostgreSQL 16 container for database tests.
   * Runs deployment script offline syntax checks (`deploy/tests/test_deploy_stub.sh`, `test_smoke.py`).
   * Runs backend migrations, seed, and Vitest suite (`server/`).
   * Runs frontend tests and Vite production build (`client/`).
   * Verifies unified multi-stage `Dockerfile` compilation.

2. **`deploy.yml` (Automated Cloud Run Release):**
   * Triggered automatically upon merge into `main` (or via manual rollback).
   * Authenticates using **Workload Identity Federation (OIDC)** through `s96ba5182-deployer`.
   * Builds and pushes the Docker container to Artifact Registry tagged with commit SHA.
   * Executes the Cloud Run migration job (`s96ba5182-migrate`).
   * Updates Cloud Run service (`s96ba5182`) to route traffic to the new revision.
   * Runs smoke test (`deploy/smoke_test.py`) against the live public URL (`/api/health`, `/api/ready`, `/`, `/api/v1/settings/public`).

### Required GitHub Environment Configuration (`demo`)

The GitHub repository must configure an environment named `demo` restricted to branch `main`:

| Environment Variable | Value for Shared Course Project |
| :--- | :--- |
| `GCP_PROJECT_ID` | `cpe-se-course-2026` |
| `GCP_REGION` | `asia-southeast1` |
| `WIF_PROVIDER` | `projects/670075229477/locations/global/workloadIdentityPools/s96ba5182-pool/providers/s96ba5182-provider` |
| `WIF_SERVICE_ACCOUNT` | `s96ba5182-deployer@cpe-se-course-2026.iam.gserviceaccount.com` |

---

## 4. Deployment & Rollback Runbook

### 4.1 First Deploy & Manual Deployment (`deploy/deploy.sh`)

In the Shared Course Project, `deploy/deploy.sh` is configured as **update-only**:
* It updates pre-existing resources (`gcloud run services update`, `gcloud run jobs update`).
* It does **not** create or alter Cloud SQL instances, IAM policies, or new secrets.
* **Default Safety Mode:** `DRY_RUN=1` is enabled by default to prevent accidental deployments.

#### Execution Steps (Google Cloud Shell)

```bash
# 1. Inspect execution plan safely with dry-run (default is DRY_RUN=1)
bash deploy/deploy.sh

# 2. Execute live deployment from reviewed 'main' branch
DRY_RUN=0 bash deploy/deploy.sh

# 3. Optional: deploy and seed demo doctors/patients
DRY_RUN=0 bash deploy/deploy.sh --demo
```

Upon successful deployment, the script displays:
* Service URL: `https://s96ba5182-<hash>-as.a.run.app`
* Health Check: `/api/health`
* Readiness Check: `/api/ready`
* Admin Email: `admin@appointly.local` (password stored safely in `s96ba5182-admin-password`)

### 4.2 Automated Rollback Procedure

If a deployed revision introduces an issue in production:
1. Navigate to **GitHub Actions** > **Deploy demo** workflow.
2. Click **Run workflow** on the `main` branch.
3. In the `image_tag` input, enter the full 40-character commit SHA of the last known healthy release.
4. The workflow verifies the existing container digest in Artifact Registry, skips rebuild/migration, updates the Cloud Run service traffic directly, and runs smoke tests.

---

## 5. Teardown Policy

> [!IMPORTANT]
> **Teardown Policy on Shared Course Project:**
> In the centralized course environment (`cpe-se-course-2026`), students must **not** delete shared database instances, service accounts, or repositories.
> 
> * The script `deploy/teardown.sh` is **intentionally disabled** (`exit 1`) to prevent inadvertent disruption of shared infrastructure.
> * Resource pausing, scale-down, or cleanup at the end of the semester/lab evaluation is handled exclusively by Course TAs via the Course Portal.
