# API Guide

Ghost Shift ships an embedded OpenAPI document at `/openapi.yaml` and stores the source file in [server/api/openapi.yaml](../server/api/openapi.yaml).

## Public endpoints

- `GET /api/status`
- `GET /api/sessions`
- `GET /api/public/snapshot`
- `GET /api/public/timeline`
- `GET /api/public/replay`
- `GET /api/public/agent/{publicId}/stats`
- `GET /api/public/zones/heatmap`
- `GET /api/public/models/distribution`
- `GET /api/public/metrics/live`

## Operational endpoints

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /openapi.yaml`

## Internal endpoints

When `ENABLE_INTERNAL_API=true`, the following routes are available behind bearer-token auth:

- `GET /internal-api/health`
- `GET /internal-api/presence`
- `GET /internal-api/channels`
- `GET /internal-api/nodes`
- `GET /internal-api/cron`

## Swagger / OpenAPI workflow

1. Start the server.
2. Download `http://127.0.0.1:3002/openapi.yaml`.
3. Import it into Swagger UI, Redoc, Insomnia, or Postman.

Example:

```bash
curl -fsS http://127.0.0.1:3002/openapi.yaml -o ghost-shift-openapi.yaml
```
