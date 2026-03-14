# Performance Tuning

## 1. Observe Before Tuning

Scrape `GET /metrics` with Prometheus. The server exports:

- HTTP request counts and latency histograms
- cache lookup/store/warm counters
- cache entry gauges
- gateway connectivity and uptime
- public business metrics for agents, models, tokens, messages, and zone activity

Use the Grafana dashboard at [deploy/grafana/dashboards/ghost-shift-overview.json](../deploy/grafana/dashboards/ghost-shift-overview.json) to watch:

- `ghost_shift_public_agents`
- `ghost_shift_public_agents_by_status`
- `ghost_shift_public_agents_by_zone`
- `ghost_shift_public_tokens`
- `ghost_shift_public_activity_score_average`

## 2. Cache Strategy

Ghost Shift already supports two cache tiers:

- Redis when `REDIS_URL` is configured
- in-process memory cache as the fallback

Recommended starting points:

- `CACHE_TTL_SECONDS=5` for high-churn public endpoints
- `CACHE_MEMORY_MAX_ENTRIES=512` for single-instance deployments
- `CACHE_WARM_ON_STARTUP=true` for Kubernetes and blue-green releases

Use [scripts/warm-cache.sh](../scripts/warm-cache.sh) after deploys and before blue-green promotion:

```bash
./scripts/warm-cache.sh https://ghostshift.example.com
```

If cache miss ratio stays above 40%:

- verify Redis is reachable from all replicas
- increase `CACHE_TTL_SECONDS` for snapshot-heavy traffic from `5` to `10`
- warm timeline, replay, and analytics endpoints during deploy
- avoid restarting all replicas at once

## 3. CDN Recommendations

The safest CDN split is:

- cache `/assets/*` aggressively for `1y` with `immutable`
- keep `/api/*`, `/healthz`, `/readyz`, and `/metrics` dynamic
- optionally add a very short CDN TTL of `5-15s` only for anonymous public JSON endpoints if origin load is high

Recommended behavior:

- do not cache `/metrics` at the CDN
- do not cache internal API responses
- preserve `X-Request-ID`
- enable gzip or brotli for JSON and JS bundles

The Nginx example in [deploy/nginx/ghost-shift.conf](../deploy/nginx/ghost-shift.conf) already marks `/assets/` as immutable and keeps `/api/` dynamic.

## 4. Load Balancer Configuration

For multi-instance deployments:

- use shared Redis so cache state survives pod or instance rotation
- use `least_conn` or round-robin balancing
- keep `/metrics` private and scrape each instance directly if possible
- avoid sticky sessions because the public API is stateless once Redis is shared

Suggested upstream strategy:

- 2 replicas minimum for production
- readiness checks on `/readyz`
- liveness checks on `/healthz`
- rolling updates only when Redis is enabled, otherwise use blue-green cutover

The Nginx sample upstream is already prepared for multiple backend nodes with `least_conn`.

## 5. History Recorder Tuning

Timeline and replay data are backed by the public history recorder.

Tune it with:

- `PUBLIC_HISTORY_INTERVAL_SECONDS`
- `PUBLIC_HISTORY_RETENTION_HOURS`

Tradeoffs:

- lower interval means better replay fidelity but higher write volume
- higher retention increases disk usage and cache churn
- large retention windows increase analytics query cost

Reasonable defaults:

- `PUBLIC_HISTORY_INTERVAL_SECONDS=30`
- `PUBLIC_HISTORY_RETENTION_HOURS=24`

## 6. Logging and Slow Requests

Logs are emitted as JSON and every request gets an `X-Request-ID`.

Recommended indexing fields:

- `request_id`
- `route`
- `status`
- `duration_ms`
- `cache`

Tune `REQUEST_SLOW_THRESHOLD_MS` to surface hot paths:

- `250ms` for normal production visibility
- `100ms` for performance work
- `500ms` when traffic is noisy and you want fewer warnings

## 7. Rate Limiting and Edge Protection

Apply request limits at the ingress or reverse proxy:

- `20 rps` baseline per client for `/api/*`
- burst multiplier `2-3`
- stricter limits on `/internal-api/*`

When using Caddy, apply rate limits at the CDN, ingress controller, or external load balancer because stock Caddy does not include a built-in limiter.

## 8. Validation Loop

After any cache, CDN, or load-balancer change:

```bash
./scripts/warm-cache.sh https://ghostshift.example.com
./scripts/ops-smoke-test.sh https://ghostshift.example.com
```

Then confirm:

- p95 latency dropped
- cache hit ratio improved
- no increase in 429 or 5xx responses
- public agent counts and activity metrics look sane
