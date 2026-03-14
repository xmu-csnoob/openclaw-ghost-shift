#!/bin/sh
set -eu

BASE_URL="${1:-${GHOST_SHIFT_BASE_URL:-http://127.0.0.1:3002}}"

for endpoint in \
  /healthz \
  /api/status \
  /api/sessions \
  /api/public/snapshot \
  /api/public/timeline \
  /api/public/replay \
  /api/public/zones/heatmap \
  /api/public/models/distribution \
  /api/public/metrics/live
do
  curl -fsS -o /dev/null "${BASE_URL}${endpoint}"
  printf 'warmed %s\n' "$endpoint"
done
