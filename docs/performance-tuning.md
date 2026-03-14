# Performance Tuning

## Monitoring

Scrape `GET /metrics` with Prometheus. The server exports:

- HTTP request counts
- HTTP request duration histograms
- cache operation counts by hit, miss, store, and warm result
- cache entry counts
- gateway connectivity and uptime

Use `REQUEST_SLOW_THRESHOLD_MS` to control when request logs are promoted to `slow_request` warnings.

## Caching

Ghost Shift now supports two cache layers:

- Redis when `REDIS_URL` is configured and reachable
- in-process memory cache as the always-available fallback

Recommended starting values:

- `CACHE_TTL_SECONDS=5` for public status and snapshot traffic
- `CACHE_MEMORY_MAX_ENTRIES=512` for small single-instance deployments
- `CACHE_WARM_ON_STARTUP=true` when you want the process to prefill caches after boot

Use [scripts/warm-cache.sh](../scripts/warm-cache.sh) after deploys to precompute the hot endpoints.

## History retention

The public history recorder drives timeline, replay, and analytics endpoints. Tune it with:

- `PUBLIC_HISTORY_INTERVAL_SECONDS`
- `PUBLIC_HISTORY_RETENTION_HOURS`

Lower intervals improve replay fidelity but increase disk writes and cache churn. Increase retention only when you really need longer lookback windows.

## Logging

Logs are emitted as JSON and every HTTP request gets an `X-Request-ID`.

Recommended practices:

- ship stdout to your log collector unchanged
- index `request_id`, `route`, `status`, and `duration_ms`
- alert on sustained `slow_request` events and rising cache `miss` rates

## Deployment-specific advice

- Prefer Redis for multi-instance or Kubernetes deployments so cache state survives pod rotation.
- Keep `/metrics` private to your cluster or VPN and scrape it from Prometheus instead of publishing it to the public internet.
- Use `/healthz` for liveness checks and `/readyz` for readiness checks.
