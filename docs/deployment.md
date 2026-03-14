# Deployment Guide

Ghost Shift ships as a single Go server that serves both the compiled SPA and the public API. In production you usually deploy one backend process on `127.0.0.1:3002` and place Nginx or Caddy in front of it.

## 1. Prepare production configuration

Copy [`.env.production.example`](../.env.production.example) to `.env.production` and fill in the gateway settings:

```bash
cp .env.production.example .env.production
```

Required variables:

- `GATEWAY_URL`
- `GATEWAY_TOKEN` or `GATEWAY_CONFIG_PATH`

Optional but common:

- `REDIS_URL=redis://redis:6379/0` when you want Redis-backed response caching
- `CACHE_TTL_SECONDS`, `CACHE_MEMORY_MAX_ENTRIES`, and `CACHE_WARM_ON_STARTUP`
- `LOG_LEVEL` and `REQUEST_SLOW_THRESHOLD_MS` for structured performance logging
- `VITE_PUBLIC_API_BASE=/office/api` when you publish Ghost Shift under `/office/`
- `ENABLE_INTERNAL_API=true` and `INTERNAL_API_TOKEN=...` if you need `/internal-api/*`

## 2. Local release verification

Before shipping, verify the same commands the CI workflow runs:

```bash
npm ci
npm run build
cd server
go test ./...
go build -trimpath -o ghost-shift-server .
```

## 3. Docker image

The root [Dockerfile](../Dockerfile) uses three stages:

- Node stage for the frontend asset build
- Go stage for the backend binary
- Alpine runtime stage with only the binary, static assets, and CA certificates

Build a local image:

```bash
docker build -t ghost-shift:local .
```

For subpath deployments, bake the public API base into the frontend build:

```bash
docker build --build-arg VITE_PUBLIC_API_BASE=/office/api -t ghost-shift:local .
```

Run the container:

```bash
docker run --env-file .env.production -p 3002:3002 ghost-shift:local
```

The container already defaults to:

- `BIND_ADDR=0.0.0.0`
- `PORT=3002`
- `STATIC_DIR=/app/dist`

The runtime now also exposes:

- `/healthz` for liveness checks
- `/readyz` for readiness checks
- `/metrics` for Prometheus scraping
- `/openapi.yaml` for the embedded OpenAPI spec

## 4. Docker Compose

The full local-or-single-host stack lives in [deploy/docker-compose.yml](../deploy/docker-compose.yml).

Examples:

```bash
docker compose -f deploy/docker-compose.yml up --build
docker compose -f deploy/docker-compose.yml --profile cache up --build
docker compose -f deploy/docker-compose.yml --profile cache --profile observability up --build
```

Supporting files:

- [deploy/prometheus/prometheus.yml](../deploy/prometheus/prometheus.yml)
- [scripts/warm-cache.sh](../scripts/warm-cache.sh)

If you enable the `cache` profile, set `REDIS_URL=redis://redis:6379/0` in `.env.production`.

## 5. Reverse proxy

Example configs live in:

- [deploy/nginx/ghost-shift.conf](../deploy/nginx/ghost-shift.conf)
- [deploy/Caddyfile](../deploy/Caddyfile)

Both examples include:

- root deployment on its own domain
- `/office/` subpath deployment on an existing site

Subpath deployments must strip the `/office` prefix before requests reach Ghost Shift. That keeps SPA assets resolving correctly while the frontend continues to call `/office/api`.

## 6. Kubernetes

Sample manifests live in:

- [deploy/kubernetes/ghost-shift.yaml](../deploy/kubernetes/ghost-shift.yaml)
- [deploy/kubernetes/redis-optional.yaml](../deploy/kubernetes/redis-optional.yaml)

The main manifest includes:

- `ConfigMap` and `Secret` templates
- persistent storage for device identity and public history
- liveness probe on `/healthz`
- readiness probe on `/readyz`
- Prometheus scrape annotations
- a sample `Ingress`

Use the optional Redis manifest only when you want an in-cluster cache instead of an external managed Redis instance.

## 7. Health, Metrics, and Cache Warming

Operational endpoints:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /openapi.yaml`

Cache pre-warming:

```bash
./scripts/warm-cache.sh
./scripts/warm-cache.sh https://ghostshift.example.com
```

The warmup script hits the public status, snapshot, timeline, replay, and analytics endpoints so the first real request does not pay the full compute cost.

## 8. GitHub Actions CI/CD

The workflow lives at [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml).

It does the following:

- `pull_request`: `npm run build`, `go test ./...`, and `go build`
- `push` to `main` or `v*` tags: the same checks plus a multi-arch image publish to GHCR
- `workflow_dispatch`: manual run with the same image publishing path

Published image tags include branch or tag refs, Git SHA tags, and `latest` for the default branch.

## 9. Related Docs

- [docs/api.md](./api.md)
- [docs/performance-tuning.md](./performance-tuning.md)
