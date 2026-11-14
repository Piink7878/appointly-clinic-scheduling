#!/usr/bin/env bash
# ==============================================================================
# Appointly - Deliverable 1 API evidence (real HTTP calls against the running API)
# ==============================================================================
# Usage: BASE=http://localhost:4100/api/v1 bash api-evidence.sh > ../figures/logs/11-api-evidence.log
# Token values in Set-Cookie headers are redacted; everything else is the raw response.
# ==============================================================================
BASE="${BASE:-http://localhost:4100/api/v1}"
PW='ChangeMe123!'
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pretty() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.stringify(JSON.parse(s)))}catch{console.log(s)}})"; }

# call <title> <cookie-jar|-> <METHOD> <path> [json-body]
call() {
  local title="$1" jar="$2" method="$3" path="$4" body="${5:-}"
  echo
  echo "### $title"
  local args=(-s -i -X "$method" "$BASE$path" -H 'Content-Type: application/json')
  [ "$jar" != "-" ] && args+=(-b "$TMP/$jar" -c "$TMP/$jar")
  [ -n "$body" ] && args+=(-d "$body")
  [ -n "$body" ] && echo "\$ curl -X $method $path -d '$(echo "$body" | sed 's/"password":"[^"]*"/"password":"<seed demo password>"/' | cut -c1-300)'" || echo "\$ curl -X $method $path"
  curl "${args[@]}" | tr -d '\r' | awk -v RS='\n\n' 'NR==1{print; next} {print "";  printf "%s", $0 > "/dev/stderr"}' 2>"$TMP/body" \
    | grep -iE '^(HTTP/|set-cookie|content-type|retry-after)' \
    | sed -E 's/^(set-cookie: [^=]+=)[^;]+/\1<redacted>/I'
  pretty < "$TMP/body"
}

login() { call "$1" "$2" POST /auth/login "{\"email\":\"$3\",\"password\":\"$4\"}"; }

echo "# Appointly Sprint 1 - API evidence ($(date -u +%Y-%m-%dT%H:%M:%SZ), base $BASE)"

# F-001 -----------------------------------------------------------------------
login "STS-S1-001  ADMIN signs in: 200 + HttpOnly / SameSite=Strict cookies" admin admin@appointly.local "$PW"
call  "STS-S1-001  GET /auth/me returns the role of the signed-in user" admin GET /auth/me
call  "STS-S1-001  POST /auth/logout revokes the session" admin POST /auth/logout
call  "STS-S1-001  GET /auth/me after logout: 401" admin GET /auth/me
login "STS-S1-001  INACTIVE account: 403 ACCOUNT_INACTIVE" inactive inactive@appointly.local "$PW"
login "STS-S1-002  Wrong password: 401" bad patient.arisa@appointly.local 'wrong-password'
call  "STS-S1-002  Protected endpoint without a cookie: 401" - GET /doctors/me/schedule

# RBAC -------------------------------------------------------------------------
login "STS-S1-003  PATIENT signs in" patient patient.arisa@appointly.local "$PW"
call  "STS-S1-003  PATIENT -> GET /admin/patients: 403 FORBIDDEN" patient GET /admin/patients
call  "STS-S1-003  PATIENT -> PATCH /admin/settings: 403 FORBIDDEN" patient PATCH /admin/settings '{"cancellationCutoffHours":12}'

# F-006 ------------------------------------------------------------------------
login "STS-S1-008  DOCTOR signs in" doctor doctor@appointly.local "$PW"
call  "STS-S1-008  Overlapping shifts 11:00-14:00 vs 09:00-12:00: 422 INVALID_SCHEDULE_WINDOW" doctor PUT /doctors/me/schedule \
  '{"shifts":[{"dayOfWeek":6,"startTime":"09:00","endTime":"12:00","isActive":true},{"dayOfWeek":6,"startTime":"11:00","endTime":"14:00","isActive":true}]}'

# F-004 / F-005 / F-007 ----------------------------------------------------------
login "STS-S1-006  ADMIN signs in" admin2 admin@appointly.local "$PW"
call  "STS-S1-006  Service duration 0 is rejected: 400" admin2 POST /admin/services '{"serviceName":"Boundary Zero","durationMinutes":0}'
call  "STS-S1-006  Service duration 481 is rejected: 400" admin2 POST /admin/services '{"serviceName":"Boundary Over","durationMinutes":481}'
call  "STS-S1-009  Cancellation cutoff -1 is rejected: 400" admin2 PATCH /admin/settings '{"cancellationCutoffHours":-1}'
call  "STS-S1-009  Cancellation cutoff 0 (boundary) is accepted: 200" admin2 PATCH /admin/settings '{"cancellationCutoffHours":0,"fixedStartIntervalMinutes":15}'

DOC_ID=$(curl -s -b "$TMP/admin2" "$BASE/admin/doctors" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const l=j.data.items||j.data;console.log(l.find(d=>d.user?.email==='doctor@appointly.local'||d.email==='doctor@appointly.local').doctorId)})")
SVC_ID=$(curl -s -b "$TMP/admin2" "$BASE/admin/services" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const l=j.data.items||j.data;console.log(l.find(x=>x.serviceName==='General Consultation').serviceId)})")
call  "STS-S1-007  Re-assigning an already assigned (doctor, service) pair: 409 DUPLICATE_ASSIGNMENT" admin2 POST "/admin/doctors/$DOC_ID/services" "{\"serviceId\":\"$SVC_ID\"}"
