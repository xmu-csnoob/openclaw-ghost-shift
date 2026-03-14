# Troubleshooting Guide

## Health Checks

Liveness:

```bash
curl -fsS http://127.0.0.1:3002/healthz | jq .
```

Readiness:

```bash
curl -fsS http://127.0.0.1:3002/readyz | jq .
```

Common readiness failures:

- gateway disconnected
- Redis configured but unavailable
- static assets missing from `STATIC_DIR`

## No Public Data in the UI

Symptoms:

- `/api/public/snapshot` returns empty sessions
- `ghost_shift_public_agents` stays at `0`
- Grafana shows gateway connected but no workload

Checks:

```bash
curl -fsS http://127.0.0.1:3002/api/status | jq .
curl -fsS http://127.0.0.1:3002/api/public/snapshot | jq '.status, .sessions | length'
curl -fsS http://127.0.0.1:3002/metrics | grep '^ghost_shift_public_agents'
```

Likely causes:

- gateway token expired
- gateway URL points to the wrong cluster or environment
- filters upstream removed active sessions

## High Cache Miss Ratio

Symptoms:

- alert `GhostShiftCacheMissRatioHigh`
- repeated `X-Cache: MISS`
- p95 latency increases after deploy

Checks:

```bash
curl -I http://127.0.0.1:3002/api/public/snapshot
curl -fsS http://127.0.0.1:3002/metrics | grep '^ghost_shift_cache_operations_total'
./scripts/warm-cache.sh http://127.0.0.1:3002
```

Likely causes:

- Redis unavailable or misconfigured
- cache TTL too short
- pods restarted without warmup

## CORS Errors

Symptoms:

- browser console shows `blocked by CORS policy`
- API works with `curl` but fails from the portfolio site

Checks:

- verify the exact browser `Origin`
- verify ingress or reverse-proxy config in [deploy/nginx/ghost-shift.conf](../deploy/nginx/ghost-shift.conf) or [deploy/Caddyfile](../deploy/Caddyfile)
- if using Helm, inspect `ingress.annotations`

Fixes:

- allow only the exact origin you need
- include `GET, OPTIONS`
- allow headers `Authorization, Content-Type, X-Request-ID`

## Unexpected 429 Responses

Symptoms:

- API returns `429 Too Many Requests`
- deploy smoke tests fail intermittently

Checks:

- review ingress annotations such as `nginx.ingress.kubernetes.io/limit-rps`
- confirm CDN or WAF rate limiting
- allow a higher burst for warmup or replay-heavy clients

Fixes:

- increase burst multiplier from `2` to `3`
- exempt internal automation from public edge limits
- warm caches after deploy so clients do less repeated work

## Blue-Green Cutover Problems

Deploy new color:

```bash
./scripts/blue-green-deploy.sh deploy green 2026.03.14
```

Check status:

```bash
./scripts/blue-green-deploy.sh status
```

Switch traffic:

```bash
HOST=ghostshift.example.com ./scripts/blue-green-deploy.sh switch green
```

Rollback:

```bash
HOST=ghostshift.example.com ./scripts/blue-green-deploy.sh switch blue
```

If the switch fails:

- confirm both color deployments are Ready
- verify the stable Service selector `ghost-shift.dev/color`
- verify the public ingress points at the stable Service, not a color-specific Service

## Release Validation

Run the smoke test after every deploy:

```bash
./scripts/ops-smoke-test.sh https://ghostshift.example.com
```

It validates:

- `healthz`
- `readyz`
- public API endpoints
- OpenAPI export
- presence of public Prometheus metrics
