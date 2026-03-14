#!/bin/sh
set -eu

BASE_URL=${1:-${GHOST_SHIFT_BASE_URL:-http://127.0.0.1:3002}}
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

check_status() {
  endpoint=$1
  expected=$2
  code=$(curl -sS -o "$TMP_DIR/body" -w '%{http_code}' "$BASE_URL$endpoint")
  if [ "$code" != "$expected" ]; then
    printf 'FAIL %s expected %s got %s\n' "$endpoint" "$expected" "$code" >&2
    cat "$TMP_DIR/body" >&2
    exit 1
  fi
  printf 'PASS %s (%s)\n' "$endpoint" "$code"
}

check_contains() {
  endpoint=$1
  pattern=$2
  curl -fsS "$BASE_URL$endpoint" >"$TMP_DIR/body"
  if ! grep -q "$pattern" "$TMP_DIR/body"; then
    printf 'FAIL %s missing pattern %s\n' "$endpoint" "$pattern" >&2
    cat "$TMP_DIR/body" >&2
    exit 1
  fi
  printf 'PASS %s contains %s\n' "$endpoint" "$pattern"
}

check_status /healthz 200
check_status /readyz 200
check_status /api/status 200
check_status /api/public/snapshot 200
check_status /api/public/metrics/live 200
check_contains /metrics ghost_shift_public_agents
check_contains /metrics ghost_shift_http_requests_total
check_contains /openapi.yaml openapi:

printf 'Smoke test complete for %s\n' "$BASE_URL"
