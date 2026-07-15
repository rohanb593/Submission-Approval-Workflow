#!/usr/bin/env bash
# Drives the full DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED workflow
# against a running API instance, using the seeded applicant/reviewer users.
#
# Prerequisites:
#   1. Postgres running and migrated.
#   2. Seeded users: `go run ./cmd/seed` (creates applicant@example.com /
#      reviewer@example.com, both with password "password123").
#   3. API running: `go run ./cmd/api`.
#   4. `jq` installed (brew install jq).
#
# Usage: ./scripts/curl-walkthrough.sh [base_url]
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"

if ! command -v jq >/dev/null 2>&1; then
  echo "This script needs jq (brew install jq) to parse JSON responses." >&2
  exit 1
fi

step() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }

step "Login as applicant"
APPLICANT_TOKEN=$(curl -sf -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"applicant@example.com","password":"password123"}' | jq -r '.token')
echo "applicant token acquired"

step "Login as reviewer"
REVIEWER_TOKEN=$(curl -sf -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"reviewer@example.com","password":"password123"}' | jq -r '.token')
echo "reviewer token acquired"

step "Create a draft application (as applicant)"
APP_ID=$(curl -sf -X POST "$BASE_URL/applications" \
  -H "Authorization: Bearer $APPLICANT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Conference travel","category":"travel","description":"Flights and hotel for the annual conference","amount":500}' \
  | tee /dev/stderr | jq -r '.id')
echo "created application $APP_ID"

step "Reviewer cannot yet act (still DRAFT) - expect 409"
curl -s -o /dev/null -w 'status: %{http_code}\n' -X POST "$BASE_URL/applications/$APP_ID/start-review" \
  -H "Authorization: Bearer $REVIEWER_TOKEN"

step "Applicant submits the draft"
curl -sf -X POST "$BASE_URL/applications/$APP_ID/submit" \
  -H "Authorization: Bearer $APPLICANT_TOKEN" | jq .

step "Reviewer starts review"
curl -sf -X POST "$BASE_URL/applications/$APP_ID/start-review" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" | jq .

step "Applicant cannot approve their own application - expect 403"
curl -s -o /dev/null -w 'status: %{http_code}\n' -X POST "$BASE_URL/applications/$APP_ID/approve" \
  -H "Authorization: Bearer $APPLICANT_TOKEN"

step "Reviewer rejects without a comment - expect 400"
curl -s -o /dev/null -w 'status: %{http_code}\n' -X POST "$BASE_URL/applications/$APP_ID/reject" \
  -H "Authorization: Bearer $REVIEWER_TOKEN"

step "Reviewer approves"
curl -sf -X POST "$BASE_URL/applications/$APP_ID/approve" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" | jq .

step "Full detail view with audit trail"
curl -sf "$BASE_URL/applications/$APP_ID" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" | jq .

step "Applicant's own application list"
curl -sf "$BASE_URL/applications" \
  -H "Authorization: Bearer $APPLICANT_TOKEN" | jq .

echo -e "\nDone."
