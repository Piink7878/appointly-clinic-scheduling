#!/usr/bin/env bash
# ==============================================================================
# TokTickIT — release.sh (used by .github/workflows/deploy.yml)
# ==============================================================================
# WHAT THIS SCRIPT DOES
#   Update pre-provisioned resources only. Does not create SQL, IAM or secrets.
#   (Create those once with deploy/deploy.sh.)
#   Normal release : verify image -> run migration job -> update service.
#   Rollback       : verify image -> update service (NO migration, NO seed).
#
# INPUT (environment variables)
#   PROJECT_ID, REGION, IMAGE_TAG   required (IMAGE_TAG = full 40-char commit SHA)
#   SERVICE_NAME, MIGRATE_JOB_NAME  optional (default: toktickit, s96ba5182-migrate)
#   ROLLBACK                        true | false (default false)
#   RESET_ADMIN_PASSWORD            true | false (default false). ONE-SHOT admin password
#                                   rotation for this release only (see below)
#   GITHUB_ENV                      when set, SERVICE_URL / DEPLOYED_IMAGE are
#                                   appended so later workflow steps can use them
#
# ⭐ IMPORTANT
#   - If the migration job fails, `set -e` stops the script BEFORE the service is
#     updated, so a broken migration never reaches users.
#   - The image is resolved to an immutable @sha256 digest so the job and the
#     service run exactly the same image.
#   - Production seeding is create-if-missing (Admin, Clinic Settings, Services).
#     ADMIN_PASSWORD_RESET is therefore forced to false on the job before every
#     run and only set to true as a per-execution override when RESET_ADMIN_PASSWORD
#     =true. It is never persisted, so it cannot stay enabled for later releases.
#   - Offline test: deploy/tests/test_release_stub.sh
#
# REFERENCES
#   - gcloud run jobs update/execute : https://cloud.google.com/sdk/gcloud/reference/run/jobs
#   - gcloud run services update     : https://cloud.google.com/sdk/gcloud/reference/run/services/update
#   - update-traffic (--to-latest)   : https://cloud.google.com/sdk/gcloud/reference/run/services/update-traffic
#   - Artifact Registry images       : https://cloud.google.com/sdk/gcloud/reference/artifacts/docker/images/describe
#
# ⭐ CHANGE ME — groups using another tech stack must review:
#   # CHANGE ME: default SERVICE_NAME / MIGRATE_JOB_NAME and the image path
#   #            `s96ba5182/toktickit` (Artifact Registry repo / image name)
#   # CHANGE ME: how the migration is run (the Cloud Run job is created by
#   #            deploy/deploy.sh step 10 — change the command there)
# ==============================================================================
set -euo pipefail

# ------------------------------------------------------------------------------
# 1. Read and validate inputs (fail before any GCP call)
# ------------------------------------------------------------------------------
: "${PROJECT_ID:?Required}" "${REGION:?Required}" "${IMAGE_TAG:?Required}"
# CHANGE ME: default resource names.
SERVICE_NAME="${SERVICE_NAME:-s96ba5182}"
MIGRATE_JOB_NAME="${MIGRATE_JOB_NAME:-s96ba5182-migrate}"
ROLLBACK="${ROLLBACK:-false}"
RESET_ADMIN_PASSWORD="${RESET_ADMIN_PASSWORD:-false}"
[[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid image tag.' >&2; exit 1; }
[[ "$ROLLBACK" == true || "$ROLLBACK" == false ]] || { echo 'Invalid rollback mode.' >&2; exit 1; }
[[ "$RESET_ADMIN_PASSWORD" == true || "$RESET_ADMIN_PASSWORD" == false ]] || { echo 'Invalid RESET_ADMIN_PASSWORD (use true or false).' >&2; exit 1; }

# ------------------------------------------------------------------------------
# 2. Find the image and pin it by digest
#    CHANGE ME: `s96ba5182/toktickit` = <Artifact Registry repo>/<image name>.
# ------------------------------------------------------------------------------
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/s96ba5182/s96ba5182:$IMAGE_TAG"
# Resolve to a digest so the job and service run the exact same immutable image.
DIGEST_IMAGE="$(gcloud artifacts docker images describe "$IMAGE" --project="$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)')"
[[ "$DIGEST_IMAGE" == "$REGION-docker.pkg.dev/$PROJECT_ID/s96ba5182/s96ba5182@sha256:"* ]] || { echo 'Image digest not found.' >&2; exit 1; }

# ------------------------------------------------------------------------------
# 3. Database migration (normal release only; `--wait` blocks until it finishes)
#    ⭐ IMPORTANT: a failure here aborts the release (set -e) — service untouched.
# ------------------------------------------------------------------------------
if [[ "$ROLLBACK" == false ]]; then
  # Always clear ADMIN_PASSWORD_RESET on the job (scrubs a value left by hand), then
  # enable it for this single execution only when a rotation was requested.
  gcloud run jobs update "$MIGRATE_JOB_NAME" --image="$DIGEST_IMAGE" --update-env-vars="ADMIN_PASSWORD_RESET=false" --project="$PROJECT_ID" --region="$REGION" --quiet
  gcloud run jobs execute "$MIGRATE_JOB_NAME" --wait --update-env-vars="ADMIN_PASSWORD_RESET=${RESET_ADMIN_PASSWORD}" --project="$PROJECT_ID" --region="$REGION" --quiet
else
  echo 'Rollback: reuse existing image; skip tests, build, migration and seed.'
fi

# ------------------------------------------------------------------------------
# 4. Point the Cloud Run service at the image and send it 100% of traffic
# ------------------------------------------------------------------------------
gcloud run services update "$SERVICE_NAME" --image="$DIGEST_IMAGE" --project="$PROJECT_ID" --region="$REGION" --quiet
# Restore 100% traffic to the new latest revision even if it was previously pinned.
gcloud run services update-traffic "$SERVICE_NAME" --to-latest --project="$PROJECT_ID" --region="$REGION" --quiet

# ------------------------------------------------------------------------------
# 5. Report the URL (and hand it to the next workflow steps via GITHUB_ENV)
# ------------------------------------------------------------------------------
SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
echo "Service URL: $SERVICE_URL"
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'SERVICE_URL=%s\nDEPLOYED_IMAGE=%s\n' "$SERVICE_URL" "$DIGEST_IMAGE" >> "$GITHUB_ENV"
fi
