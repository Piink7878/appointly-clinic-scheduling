#!/usr/bin/env bash
# Shared-project adaptation: original CI still invokes this existing test path.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
for executable in gcloud docker; do
  printf '%s\n' '#!/usr/bin/env bash' 'echo "Unexpected cloud/build call" >&2; exit 99' > "$tmp/bin/$executable"
  chmod +x "$tmp/bin/$executable"
done
PATH="$tmp/bin:$PATH" DRY_RUN=1 bash "$ROOT/deploy/deploy.sh" > "$tmp/plan"
grep -q '\[DRY_RUN\]' "$tmp/plan"
if grep -E '^\[DRY_RUN\].*(services enable|sql instances create|add-iam-policy-binding|secrets create)' "$tmp/plan"; then
  echo 'Forbidden infrastructure command in plan' >&2; exit 1
fi
grep -q 'docker build' "$tmp/plan"
grep -q 'run jobs update' "$tmp/plan"
grep -q 'run services update' "$tmp/plan"
echo 'Shared-project deploy dry-run: PASS (no cloud or Docker execution)'
