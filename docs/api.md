# API Guide

Ghost Shift exposes an embedded OpenAPI document at `/openapi.yaml`. The source file lives in [server/api/openapi.yaml](../server/api/openapi.yaml).

Every response includes:

- `X-Request-ID` for request correlation
- `X-Cache` on cached endpoints such as snapshot, replay, timeline, and live metrics

## Public Endpoints

- `GET /api/status`
- `GET /api/sessions`
- `GET /api/public/snapshot`
- `GET /api/public/timeline`
- `GET /api/public/replay`
- `GET /api/public/agent/{publicId}/stats`
- `GET /api/public/zones/heatmap`
- `GET /api/public/models/distribution`
- `GET /api/public/metrics/live`

## Operational Endpoints

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /openapi.yaml`

## Internal Endpoints

When `ENABLE_INTERNAL_API=true`, the following routes are available behind bearer-token auth:

- `GET /internal-api/health`
- `GET /internal-api/presence`
- `GET /internal-api/channels`
- `GET /internal-api/nodes`
- `GET /internal-api/cron`

## Example Requests

Status:

```bash
curl -fsS http://127.0.0.1:3002/api/status | jq .
```

Snapshot:

```bash
curl -fsS http://127.0.0.1:3002/api/public/snapshot | jq '.status, .sessions[:3]'
```

Timeline over a window:

```bash
curl -fsS "http://127.0.0.1:3002/api/public/timeline?since=2026-03-14T00:00:00Z&until=2026-03-14T12:00:00Z" | jq .
```

Replay window:

```bash
curl -fsS "http://127.0.0.1:3002/api/public/replay?since=2026-03-14T09:00:00Z&until=2026-03-14T09:30:00Z" | jq .
```

Per-agent analytics:

```bash
curl -fsS http://127.0.0.1:3002/api/public/agent/public-123/stats | jq .
```

Live business metrics:

```bash
curl -fsS http://127.0.0.1:3002/api/public/metrics/live | jq .
```

Prometheus metrics export:

```bash
curl -fsS http://127.0.0.1:3002/metrics | grep '^ghost_shift_public_'
```

OpenAPI export:

```bash
curl -fsS http://127.0.0.1:3002/openapi.yaml -o ghost-shift-openapi.yaml
```

Internal API with bearer token:

```bash
curl -fsS \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
  http://127.0.0.1:3002/internal-api/health | jq .
```

## Browser Example

```ts
const response = await fetch("/api/public/snapshot", {
  headers: {
    "X-Request-ID": crypto.randomUUID(),
  },
});

if (!response.ok) {
  throw new Error(`snapshot failed: ${response.status}`);
}

const snapshot = await response.json();
console.log(snapshot.status, snapshot.sessions.length);
```

## Notes

- `timeline`, `replay`, `agent/{publicId}/stats`, `zones/heatmap`, and `models/distribution` all accept optional `since` and `until` query parameters in RFC3339 format.
- Public endpoints intentionally expose anonymized and coarse-grained fields only.
- For cross-origin access, configure CORS at the ingress or reverse proxy layer rather than enabling wildcards.
